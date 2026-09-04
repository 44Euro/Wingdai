import { randomInt, randomUUID } from 'node:crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { ENV } from '../config.module';
import type { Env } from '../config';
import { accounts, phoneVerifications } from '../db/schema';
import { hashSecret, verifyPassword } from './password';
import { SMS_SENDER, type SmsSender } from './sms';
import {
  decideSend,
  isExpired,
  attemptsExhausted,
  CODE_TTL_MS,
  MAX_ATTEMPTS,
} from './otp.policy';
import {
  checkTicket,
  isVerificationPurpose,
  type TicketClaims,
  type VerificationPurpose,
} from './ticket';

/** ตั๋วอายุสั้นที่พิสูจน์ว่าเบอร์นี้ผ่าน OTP แล้ว ใช้ยื่นตอนสมัครหรือตอนตั้งรหัสผ่านใหม่ */
const VERIFICATION_TTL = '15m';

/** ข้อความ SMS บอกว่ารหัสนี้ใช้ทำอะไร รหัสรีเซ็ตรหัสผ่านไม่ควรอ่านเหมือนรหัสสมัครสมาชิก */
const SMS_TEXT: Record<VerificationPurpose, (code: string) => string> = {
  phone_verify: (code) => `รหัสยืนยัน Wingdai ของคุณคือ ${code} (หมดอายุใน 5 นาที)`,
  password_reset: (code) =>
    `รหัสตั้งรหัสผ่านใหม่ Wingdai ของคุณคือ ${code} (หมดอายุใน 5 นาที) ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร`,
};

@Injectable()
export class OtpService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly jwt: JwtService,
  ) {}

  /** ออกรหัสใหม่ให้เบอร์นี้ พร้อมบังคับ cooldown และโควตาต่อชั่วโมง */
  async request(
    phone: string,
    purpose: VerificationPurpose = 'phone_verify',
  ): Promise<{ expiresAt: Date; devCode?: string }> {
    const [existing] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.phone, phone))
      .limit(1);

    // บอกตรง ๆ ว่าเบอร์นี้สมัครแล้ว ดีกว่าส่ง SMS ทิ้งแล้วให้ไปตายตอนกดสมัคร
    if (purpose === 'phone_verify' && existing) {
      throw new ConflictException({
        message: 'เบอร์นี้สมัครไว้แล้ว เข้าสู่ระบบได้เลย',
        fields: { phone: 'เบอร์นี้สมัครไว้แล้ว' },
      });
    }

    const now = new Date();

    /**
     * เบอร์ที่ไม่มีบัญชีต้องได้คำตอบหน้าตาเหมือนเบอร์ที่มี ไม่งั้นปลายทางนี้กลายเป็น
     * เครื่องไล่เดาว่าเบอร์ไหนสมัครไว้แล้ว ไม่ส่ง SMS และไม่เขียนแถว แต่คืนรูปเดิม
     */
    if (purpose === 'password_reset' && !existing) {
      return { expiresAt: new Date(now.getTime() + CODE_TTL_MS) };
    }

    const [prev] = await this.db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.phone, phone))
      .limit(1);

    const decision = decideSend(prev ?? null, now);
    if (!decision.allowed) {
      throw new HttpException(
        {
          message:
            decision.reason === 'cooldown'
              ? `ขอรหัสใหม่ได้ในอีก ${decision.retryAfterSeconds} วินาที`
              : 'ขอรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง',
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
    const row = {
      phone,
      codeHash: await hashSecret(code),
      expiresAt,
      attempts: 0,
      sendCount: decision.sendCount,
      windowStartedAt: decision.windowStartedAt,
      lastSentAt: now,
      // ขอรหัสใหม่ = ยกเลิกการยืนยันครั้งก่อน ไม่งั้นตั๋วเก่ายังใช้ได้ทั้งที่ตั้งใจเริ่มใหม่
      verifiedAt: null,
      purpose,
      ticketId: null,
    };

    await this.db
      .insert(phoneVerifications)
      .values(row)
      .onConflictDoUpdate({ target: phoneVerifications.phone, set: row });

    await this.sms.send(phone, SMS_TEXT[purpose](code));

    return this.env.NODE_ENV === 'production' ? { expiresAt } : { expiresAt, devCode: code };
  }

  /** ตรวจรหัสแล้วคืนตั๋วที่เอาไปยื่นตอนสมัคร */
  async verify(phone: string, code: string): Promise<{ verificationToken: string }> {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.phone, phone))
      .limit(1);

    if (!row || isExpired(row.expiresAt, now)) {
      throw new BadRequestException({
        message: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่',
        fields: { code: 'รหัสหมดอายุแล้ว' },
      });
    }

    if (attemptsExhausted(row.attempts)) {
      throw new HttpException(
        { message: 'กรอกรหัสผิดเกินกำหนด กรุณาขอรหัสใหม่' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!(await verifyPassword(code, row.codeHash))) {
      await this.db
        .update(phoneVerifications)
        .set({ attempts: row.attempts + 1 })
        .where(eq(phoneVerifications.phone, phone));

      const left = MAX_ATTEMPTS - (row.attempts + 1);
      throw new BadRequestException({
        message: `รหัสไม่ถูกต้อง เหลืออีก ${left} ครั้ง`,
        fields: { code: 'รหัสไม่ถูกต้อง' },
      });
    }

    // วัตถุประสงค์มาจากแถวที่ตั้งไว้ตอนขอรหัส ไม่ใช่จากสิ่งที่ผู้เรียกส่งมาตอนนี้
    const purpose = isVerificationPurpose(row.purpose) ? row.purpose : 'phone_verify';
    const ticketId = randomUUID();

    await this.db
      .update(phoneVerifications)
      .set({ verifiedAt: now, ticketId })
      .where(eq(phoneVerifications.phone, phone));

    const claims: TicketClaims = { sub: phone, typ: purpose, jti: ticketId };
    return { verificationToken: await this.jwt.signAsync(claims, { expiresIn: VERIFICATION_TTL }) };
  }

  /**
   * ใช้ตั๋วหนึ่งใบแล้วเผาทิ้ง ตรวจครบสามอย่าง: ลายเซ็น เบอร์ตรง วัตถุประสงค์ตรง
   *
   * การล้าง `ticketId` คือสิ่งที่ทำให้ตั๋วใช้ได้ครั้งเดียว — JWT เพิกถอนตัวเองไม่ได้
   * เงื่อนไข `eq(ticketId, claims.jti)` ทำให้สองคำขอที่ยิงพร้อมกันมีแค่ใบเดียวที่ได้แถว
   */
  async consumeTicket(token: string, phone: string, purpose: VerificationPurpose): Promise<void> {
    let claims: TicketClaims;
    try {
      claims = await this.jwt.verifyAsync<TicketClaims>(token);
    } catch {
      throw new BadRequestException({
        message: 'การยืนยันเบอร์หมดอายุ กรุณายืนยันใหม่',
        fields: { verificationToken: 'หมดอายุ' },
      });
    }

    const [row] = await this.db
      .select({ ticketId: phoneVerifications.ticketId })
      .from(phoneVerifications)
      .where(eq(phoneVerifications.phone, phone))
      .limit(1);

    const result = checkTicket(claims, { phone, purpose }, row?.ticketId ?? null);
    if (!result.ok) {
      if (result.reason === 'spent') {
        throw new BadRequestException({
          message: 'การยืนยันนี้ถูกใช้ไปแล้ว กรุณายืนยันเบอร์ใหม่',
          fields: { verificationToken: 'ถูกใช้ไปแล้ว' },
        });
      }
      throw new BadRequestException({
        message: 'การยืนยันเบอร์ไม่ตรงกับเบอร์ที่กรอก',
        fields: { phone: 'ยังไม่ได้ยืนยันเบอร์นี้' },
      });
    }

    const burned = await this.db
      .update(phoneVerifications)
      .set({ ticketId: null })
      .where(and(eq(phoneVerifications.phone, phone), eq(phoneVerifications.ticketId, claims.jti)))
      .returning({ phone: phoneVerifications.phone });

    if (burned.length === 0) {
      throw new BadRequestException({
        message: 'การยืนยันนี้ถูกใช้ไปแล้ว กรุณายืนยันเบอร์ใหม่',
        fields: { verificationToken: 'ถูกใช้ไปแล้ว' },
      });
    }
  }
}
