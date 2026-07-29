/** กติกาการออกและกรอกรหัส OTP เขียนเป็นฟังก์ชันบริสุทธิ์ล้วน ไม่แตะฐานข้อมูล */

/** อายุรหัสหนึ่งชุด */
export const CODE_TTL_MS = 5 * 60_000;
/** ขอรหัสใหม่ถี่กว่านี้ไม่ได้ SMS ปลายทางมักถึงช้ากว่าที่คนกดซ้ำ */
export const RESEND_COOLDOWN_MS = 60_000;
/** หน้าต่างนับโควตาการส่ง */
export const SEND_WINDOW_MS = 60 * 60_000;
/** ส่งได้กี่ครั้งต่อเบอร์ต่อหน้าต่าง */
export const MAX_SENDS_PER_WINDOW = 5;
/** กรอกผิดได้กี่ครั้งต่อรหัสหนึ่งชุด เกินแล้วรหัสชุดนั้นตาย ต้องขอใหม่ */
export const MAX_ATTEMPTS = 5;

export type SendState = {
  lastSentAt: Date;
  sendCount: number;
  windowStartedAt: Date;
};

export type SendDecision =
  | { allowed: true; sendCount: number; windowStartedAt: Date }
  | { allowed: false; retryAfterSeconds: number; reason: 'cooldown' | 'quota' };

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

/** ตัดสินว่าตอนนี้ส่งรหัสให้เบอร์นี้ได้ไหม และถ้าได้ ตัวนับควรเป็นเท่าไหร่ */
export function decideSend(prev: SendState | null, now: Date): SendDecision {
  if (!prev) return { allowed: true, sendCount: 1, windowStartedAt: now };

  const sinceLast = now.getTime() - prev.lastSentAt.getTime();
  if (sinceLast < RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: seconds(RESEND_COOLDOWN_MS - sinceLast),
    };
  }

  // หน้าต่างเดิมหมดอายุแล้ว เริ่มนับใหม่จากศูนย์
  const windowAge = now.getTime() - prev.windowStartedAt.getTime();
  if (windowAge >= SEND_WINDOW_MS) {
    return { allowed: true, sendCount: 1, windowStartedAt: now };
  }

  if (prev.sendCount >= MAX_SENDS_PER_WINDOW) {
    return {
      allowed: false,
      reason: 'quota',
      retryAfterSeconds: seconds(SEND_WINDOW_MS - windowAge),
    };
  }

  return { allowed: true, sendCount: prev.sendCount + 1, windowStartedAt: prev.windowStartedAt };
}

export const isExpired = (expiresAt: Date, now: Date): boolean => expiresAt.getTime() <= now.getTime();

export const attemptsExhausted = (attempts: number): boolean => attempts >= MAX_ATTEMPTS;
