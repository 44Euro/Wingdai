import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull, or } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { accounts, restaurants, riderProfiles, phoneVerifications } from '../db/schema';
import { hashPassword, verifyPassword, burnPasswordTime } from './password';
import { normalizePhone, THAI_MOBILE } from './phone';
import { OtpService } from './otp.service';
import { GoogleVerifier } from './google';
import type {
  RegisterInput, LoginInput, GoogleRegisterInput, ChangePasswordInput, ChangePhoneInput,
  ResetPasswordInput,
} from './dto';
import type { AccountType } from './roles';
import { PlatformService } from '../platform/platform.service';

/** อายุตั๋วเข้าใช้งาน ยาวเพราะเป็นแอปมือถือ คนไม่คาดหวังว่าต้องล็อกอินใหม่ทุกอาทิตย์ */
const SESSION_TTL = '30d';

/** ตั๋วที่บอกว่า "คนนี้พิสูจน์กับ Google แล้ว" ระหว่างเดินฟอร์มสั้น + OTP */
const GOOGLE_LINK_TTL = '15m';

export type SessionClaims = { sub: string; typ: 'session'; act: AccountType };

type GoogleLinkClaims = {
  /** `sub` ของ Google ไม่ใช่ id บัญชีเรา ตอนออกตั๋วนี้ยังไม่มีบัญชี */
  sub: string;
  typ: 'google_link';
  email: string | null;
  name: string | null;
};

export type GoogleSignInResult =
  | { needsRegistration: false; token: string; account: PublicAccount }
  | {
      needsRegistration: true;
      googleToken: string;
      prefill: { email: string | null; fullName: string | null };
    };

/** รูปร่างเดียวกับ Account ในแอปมือถือ เพื่อให้สลับจากรีโปจำลองมาเป็นของจริงได้โดยไม่แก้จอ */
export type PublicAccount = {
  id: string;
  accountType: AccountType;
  username: string;
  fullName: string;
  /** ชื่ออักษรละติน ว่างได้ แอปเลือกเองว่าจะโชว์อันไหนตามภาษาที่ตั้งไว้ */
  fullNameEn: string | null;
  phone: string;
  email: string | null;
  riderApproval?: 'pending' | 'approved' | 'rejected';
  ownedRestaurantIds: string[];
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly google: GoogleVerifier,
    private readonly platform: PlatformService,
  ) {}

  async register(input: RegisterInput): Promise<{ token: string; account: PublicAccount }> {
    // design SA4 ปิดรับสมัครชั่วคราวต้องกั้นที่เซิร์ฟเวอร์ ไม่ใช่ซ่อนปุ่มในแอป
    if (!(await this.platform.isEnabled('registration_open'))) {
      throw new BadRequestException({ message: 'ตอนนี้ปิดรับสมัครสมาชิกใหม่ชั่วคราว' });
    }
    await this.otp.consumeTicket(input.verificationToken, input.phone, 'phone_verify');

    const clash = await this.db
      .select({ username: accounts.username, phone: accounts.phone })
      .from(accounts)
      .where(or(eq(accounts.username, input.username), eq(accounts.phone, input.phone)));

    if (clash.length > 0) {
      const fields: Record<string, string> = {};
      if (clash.some((c) => c.username === input.username)) fields.username = 'ชื่อผู้ใช้นี้มีคนใช้แล้ว';
      if (clash.some((c) => c.phone === input.phone)) fields.phone = 'เบอร์นี้สมัครไว้แล้ว';
      throw new ConflictException({ message: 'สมัครไม่สำเร็จ', fields });
    }

    // hash ก่อนเปิดทรานแซกชัน argon2 กินเวลาราว 50ms ไม่ควรถือ transaction ค้างไว้รอ
    const passwordHash = await hashPassword(input.password);

    const account = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(accounts)
        .values({
          // product-spec §4.1 ไม่มีทางสร้าง admin ผ่านทางนี้ได้ เพราะ dto รับแค่ user กับ rider
          accountType: input.accountType,
          username: input.username,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone,
          phoneVerifiedAt: new Date(),
          email: input.email ?? null,
        })
        .returning();

      // ตั๋วยืนยันใช้แล้วทิ้ง ลบทันทีในทรานแซกชันเดียวกับการสร้างบัญชี
      await tx.delete(phoneVerifications).where(eq(phoneVerifications.phone, input.phone));

      return created!;
    });

    /** บัญชี rider ยังไม่มี rider_profiles ตอนนี้ เอกสารทั้งชุด (บัตรประชาชน ใบขับขี่ พ.ร.บ.) */
    return { token: await this.issueToken(account.id, account.accountType), account: await this.publicAccount(account.id) };
  }

  async login(input: LoginInput): Promise<{ token: string; account: PublicAccount }> {
    const identifier = input.identifier.toLowerCase();
    const asPhone = normalizePhone(identifier);

    // product-spec §4.2 identifier คือ username หรือเบอร์โทร อีเมลใช้ล็อกอินไม่ได้
    const match = THAI_MOBILE.test(asPhone)
      ? or(eq(accounts.username, identifier), eq(accounts.phone, asPhone))
      : eq(accounts.username, identifier);

    const [found] = await this.db
      .select()
      .from(accounts)
      .where(and(match, isNull(accounts.disabledAt)))
      .limit(1);

    // บัญชีที่สมัครผ่าน Google อย่างเดียวยังไม่มีรหัสผ่าน ตอบเหมือนกรณีหาไม่เจอทุกประการ
    if (!found?.passwordHash) {
      // เผาเวลาให้เท่ากับเคสรหัสผิด ไม่งั้นจับเวลาตอบกลับก็ไล่ได้ว่ามี username ไหนอยู่จริง
      await burnPasswordTime(input.password);
      throw new UnauthorizedException({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    if (!(await verifyPassword(input.password, found.passwordHash))) {
      throw new UnauthorizedException({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    return { token: await this.issueToken(found.id, found.accountType), account: await this.publicAccount(found.id) };
  }

  /** ขั้นแรกของ Google sign-in ตรวจ token แล้วบอกว่าคนนี้เคยผูกบัญชีไว้หรือยัง */
  async googleSignIn(idToken: string): Promise<GoogleSignInResult> {
    const identity = await this.google.verify(idToken);

    const [linked] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.googleSub, identity.sub), isNull(accounts.disabledAt)))
      .limit(1);

    if (linked) {
      return {
        needsRegistration: false,
        token: await this.issueToken(linked.id, linked.accountType),
        account: await this.publicAccount(linked.id),
      };
    }

    /** จงใจ ไม่ จับคู่บัญชีเดิมด้วยอีเมลที่ตรงกัน */
    const claims: GoogleLinkClaims = {
      sub: identity.sub,
      typ: 'google_link',
      email: identity.email,
      name: identity.name,
    };

    return {
      needsRegistration: true,
      googleToken: await this.jwt.signAsync(claims, { expiresIn: GOOGLE_LINK_TTL }),
      // เติมให้ล่วงหน้าในฟอร์มสั้น ผู้ใช้แก้ได้ ไม่ใช่ข้อมูลที่เราเชื่อว่าถูกต้อง
      prefill: { email: identity.email, fullName: identity.name },
    };
  }

  /** ขั้นที่สอง ผูก Google เข้ากับบัญชีใหม่ หลังผ่านฟอร์มสั้นและ OTP แล้ว */
  async googleRegister(input: GoogleRegisterInput): Promise<{ token: string; account: PublicAccount }> {
    let claims: GoogleLinkClaims;
    try {
      claims = await this.jwt.verifyAsync<GoogleLinkClaims>(input.googleToken);
    } catch {
      throw new UnauthorizedException({ message: 'การยืนยันกับ Google หมดอายุ กรุณาเริ่มใหม่' });
    }
    if (claims.typ !== 'google_link') {
      throw new UnauthorizedException({ message: 'ตั๋วนี้ใช้สมัครไม่ได้' });
    }

    await this.otp.consumeTicket(input.verificationToken, input.phone, 'phone_verify');

    const clash = await this.db
      .select({ username: accounts.username, phone: accounts.phone, googleSub: accounts.googleSub })
      .from(accounts)
      .where(
        or(
          eq(accounts.username, input.username),
          eq(accounts.phone, input.phone),
          eq(accounts.googleSub, claims.sub),
        ),
      );

    if (clash.length > 0) {
      const fields: Record<string, string> = {};
      if (clash.some((c) => c.username === input.username)) fields.username = 'ชื่อผู้ใช้นี้มีคนใช้แล้ว';
      if (clash.some((c) => c.phone === input.phone)) {
        fields.phone = 'เบอร์นี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่าน';
      }
      if (clash.some((c) => c.googleSub === claims.sub)) {
        fields.google = 'บัญชี Google นี้ผูกไว้กับผู้ใช้อื่นแล้ว';
      }
      throw new ConflictException({ message: 'สมัครไม่สำเร็จ', fields });
    }

    const account = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(accounts)
        .values({
          accountType: input.accountType,
          username: input.username,
          // ยังไม่มีรหัสผ่าน ตั้งทีหลังได้ผ่านเส้นทางลืมรหัสผ่าน (OTP ไปเบอร์ที่ยืนยันแล้ว)
          passwordHash: null,
          googleSub: claims.sub,
          fullName: input.fullName,
          phone: input.phone,
          phoneVerifiedAt: new Date(),
          email: claims.email,
        })
        .returning();

      await tx.delete(phoneVerifications).where(eq(phoneVerifications.phone, input.phone));
      return created!;
    });

    return {
      token: await this.issueToken(account.id, account.accountType),
      account: await this.publicAccount(account.id),
    };
  }

  private issueToken(id: string, accountType: PublicAccount['accountType']): Promise<string> {
    const claims: SessionClaims = { sub: id, typ: 'session', act: accountType };
    return this.jwt.signAsync(claims, { expiresIn: SESSION_TTL });
  }

  /** ประกอบข้อมูลบัญชีที่ปลอดภัยพอจะส่งออกไป ไม่มี password_hash เด็ดขาด */
  /** แก้โปรไฟล์ (design C21) */
  async updateProfile(
    accountId: string,
    input: { fullName: string; email: string | null },
  ): Promise<PublicAccount> {
    const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;

    if (email) {
      // อีเมลเป็นช่องทางรีเซ็ตรหัสผ่าน สองบัญชีใช้เบอร์เดียวกันไม่ได้ฉันใด อีเมลก็ฉันนั้น
      const clash = await this.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      if (clash[0] && clash[0].id !== accountId) {
        throw new ConflictException({ fields: { email: 'อีเมลนี้มีคนใช้แล้ว' } });
      }
    }

    const [row] = await this.db
      .update(accounts)
      .set({ fullName: input.fullName.trim(), email })
      .where(eq(accounts.id, accountId))
      .returning({ id: accounts.id });

    if (!row) throw new UnauthorizedException({ message: 'ไม่พบบัญชีนี้' });
    return this.publicAccount(accountId);
  }

  /**
   * เปลี่ยนรหัสผ่าน ต้องผ่านรหัสเดิมก่อนเสมอ
   * เผาเวลาเท่ากันทุกทางเหมือนตอนล็อกอิน ไม่งั้นเวลาตอบบอกได้ว่ารหัสเดิมถูกหรือผิด
   */
  async changePassword(accountId: string, input: ChangePasswordInput): Promise<PublicAccount> {
    const [row] = await this.db
      .select({ passwordHash: accounts.passwordHash })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!row?.passwordHash) {
      await burnPasswordTime(input.currentPassword);
      throw new UnauthorizedException({ message: 'ไม่พบบัญชีนี้' });
    }
    if (!(await verifyPassword(input.currentPassword, row.passwordHash))) {
      throw new UnauthorizedException({ fields: { currentPassword: 'รหัสผ่านเดิมไม่ถูกต้อง' } });
    }

    await this.db
      .update(accounts)
      .set({ passwordHash: await hashPassword(input.newPassword) })
      .where(eq(accounts.id, accountId));

    return this.publicAccount(accountId);
  }

  /**
   * ตั้งรหัสผ่านใหม่หลังยืนยันเบอร์ ไม่ต้องล็อกอิน (product-spec §4.2 "forgot password")
   *
   * ตอบเหมือนกันทุกกรณีโดยตั้งใจ ทั้งเบอร์ที่ไม่มีบัญชีและเบอร์ที่มี — ปลายทางนี้ไม่ต้อง
   * ล็อกอินและยกบัญชีให้ ถ้าตอบต่างกันมันก็กลายเป็นเครื่องไล่เดาว่าเบอร์ไหนสมัครไว้แล้ว
   * ตั๋วถูกเผาก่อนเสมอ คนที่เดาเบอร์มั่วจึงเสีย OTP หนึ่งใบต่อการเดาหนึ่งครั้ง
   *
   * บัญชีที่สมัครผ่าน Google ยังไม่มีรหัสผ่าน เส้นทางนี้คือที่ที่มันได้รหัสแรก (§4.2)
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await this.otp.consumeTicket(input.verificationToken, input.phone, 'password_reset');

    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.phone, input.phone))
      .limit(1);

    if (!row) return;

    await this.db
      .update(accounts)
      .set({ passwordHash: await hashPassword(input.newPassword) })
      .where(eq(accounts.id, row.id));
  }

  /**
   * เปลี่ยนเบอร์ ต้องยืนยัน OTP ของเบอร์ใหม่ก่อน
   * เบอร์ใช้ล็อกอินได้และเป็นช่องทางกู้บัญชี ปล่อยให้แก้ลอย ๆ คือเปิดทางยึดบัญชี
   */
  async changePhone(accountId: string, input: ChangePhoneInput): Promise<PublicAccount> {
    await this.otp.consumeTicket(input.verificationToken, input.phone, 'phone_verify');

    const clash = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.phone, input.phone))
      .limit(1);
    if (clash[0] && clash[0].id !== accountId) {
      throw new ConflictException({ fields: { phone: 'เบอร์นี้มีคนใช้แล้ว' } });
    }

    const [row] = await this.db
      .update(accounts)
      .set({ phone: input.phone })
      .where(eq(accounts.id, accountId))
      .returning({ id: accounts.id });

    if (!row) throw new UnauthorizedException({ message: 'ไม่พบบัญชีนี้' });
    return this.publicAccount(accountId);
  }

  async publicAccount(accountId: string): Promise<PublicAccount> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (!row) throw new UnauthorizedException({ message: 'ไม่พบบัญชีนี้' });

    const owned = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(and(eq(restaurants.ownerUserId, row.id), eq(restaurants.isApproved, true)));

    const account: PublicAccount = {
      id: row.id,
      accountType: row.accountType,
      username: row.username,
      fullName: row.fullName,
      fullNameEn: row.fullNameEn,
      phone: row.phone,
      email: row.email,
      ownedRestaurantIds: owned.map((r) => r.id),
    };

    if (row.accountType === 'rider') {
      const [profile] = await this.db
        .select({ approval: riderProfiles.approval })
        .from(riderProfiles)
        .where(eq(riderProfiles.accountId, row.id))
        .limit(1);
      // ยังไม่ส่งเอกสาร = ยังรออนุมัติ ไม่ใช่ "อนุมัติแล้ว" ค่าเริ่มต้นต้องปลอดภัยไว้ก่อน
      account.riderApproval = profile?.approval ?? 'pending';
    }

    return account;
  }

  /** ใช้โดย JwtGuard ตรวจว่าบัญชียังใช้งานได้อยู่ ไม่ใช่เชื่อ claims ในตั๋วอย่างเดียว */
  async assertActive(accountId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), isNull(accounts.disabledAt)))
      .limit(1);
    if (!row) throw new UnauthorizedException({ message: 'บัญชีนี้ถูกปิดการใช้งาน' });
  }
}
