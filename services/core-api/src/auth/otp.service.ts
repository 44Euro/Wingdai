import { randomInt } from 'node:crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
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

/** ตั๋วอายุสั้นที่พิสูจน์ว่าเบอร์นี้ผ่าน OTP แล้ว ใช้ยื่นตอนสมัคร */
const VERIFICATION_TTL = '15m';
type VerificationClaims = { sub: string; typ: 'phone_verify' };

@Injectable()
export class OtpService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly jwt: JwtService,
  ) {}

  /** ออกรหัสใหม่ให้เบอร์นี้ พร้อมบังคับ cooldown และโควตาต่อชั่วโมง */
  async request(phone: string): Promise<{ expiresAt: Date; devCode?: string }> {
    const [existing] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.phone, phone))
      .limit(1);

    // บอกตรง ๆ ว่าเบอร์นี้สมัครแล้ว ดีกว่าส่ง SMS ทิ้งแล้วให้ไปตายตอนกดสมัคร
    if (existing) {
      throw new ConflictException({
        message: 'เบอร์นี้สมัครไว้แล้ว เข้าสู่ระบบได้เลย',
        fields: { phone: 'เบอร์นี้สมัครไว้แล้ว' },
      });
    }

    const now = new Date();
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
    };

    await this.db
      .insert(phoneVerifications)
      .values(row)
      .onConflictDoUpdate({ target: phoneVerifications.phone, set: row });

    await this.sms.send(phone, `รหัสยืนยัน Wingdai ของคุณคือ ${code} (หมดอายุใน 5 นาที)`);

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

    await this.db
      .update(phoneVerifications)
      .set({ verifiedAt: now })
      .where(eq(phoneVerifications.phone, phone));

    const claims: VerificationClaims = { sub: phone, typ: 'phone_verify' };
    return { verificationToken: await this.jwt.signAsync(claims, { expiresIn: VERIFICATION_TTL }) };
  }

  /** ตั๋วต้องตรงกับเบอร์ที่กำลังจะสมัครด้วย ไม่ใช่แค่ verify ว่าลายเซ็นถูก */
  async assertPhoneVerified(token: string, phone: string): Promise<void> {
    let claims: VerificationClaims;
    try {
      claims = await this.jwt.verifyAsync<VerificationClaims>(token);
    } catch {
      throw new BadRequestException({
        message: 'การยืนยันเบอร์หมดอายุ กรุณายืนยันใหม่',
        fields: { verificationToken: 'หมดอายุ' },
      });
    }

    if (claims.typ !== 'phone_verify' || claims.sub !== phone) {
      throw new BadRequestException({
        message: 'การยืนยันเบอร์ไม่ตรงกับเบอร์ที่กรอก',
        fields: { phone: 'ยังไม่ได้ยืนยันเบอร์นี้' },
      });
    }
  }
}
