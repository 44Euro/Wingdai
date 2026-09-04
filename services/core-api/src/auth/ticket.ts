/**
 * ตั๋วยืนยันเบอร์ กติกาล้วน ไม่แตะฐานข้อมูล (product-spec §4.2)
 *
 * ตั๋วเดิมบอกแค่ "เบอร์นี้ผ่าน OTP แล้ว" ไม่บอกว่ายืนยันไว้เพื่ออะไร และใช้ซ้ำได้จนหมดอายุ
 * ตอนมีผู้บริโภคแค่สมัครสมาชิกกับเปลี่ยนเบอร์ยังพอไหว เพราะทั้งคู่บังคับให้พิสูจน์เบอร์อยู่แล้ว
 * และเปลี่ยนเบอร์ยังต้องล็อกอินซ้อนอีกชั้น แต่รีเซ็ตรหัสผ่านไม่ต้องล็อกอินและยกบัญชีให้เลย
 * ตั๋วอเนกประสงค์ที่ใช้ซ้ำได้จึงกลายเป็นกุญแจผี — หนึ่ง OTP ยึดบัญชีได้ไม่จำกัดครั้ง
 */
export const VERIFICATION_PURPOSES = ['phone_verify', 'password_reset'] as const;
export type VerificationPurpose = (typeof VERIFICATION_PURPOSES)[number];

export type TicketClaims = {
  sub: string;
  typ: VerificationPurpose;
  /** ระบุตั๋วใบนี้ ฐานจำไว้ใบเดียว ใช้แล้วล้างทิ้ง ตั๋วจึงใช้ได้ครั้งเดียว */
  jti: string;
};

export type TicketCheck =
  | { ok: true }
  | { ok: false; reason: 'phone' | 'purpose' | 'spent' };

export function isVerificationPurpose(value: unknown): value is VerificationPurpose {
  return VERIFICATION_PURPOSES.includes(value as VerificationPurpose);
}

/**
 * ตั๋วใบนี้ใช้กับงานนี้ได้ไหม เรียกหลังตรวจลายเซ็นแล้วเท่านั้น
 *
 * `storedJti` คือตั๋วใบที่ฐานจำไว้สำหรับเบอร์นี้ `null` = ถูกใช้ไปแล้วหรือไม่เคยมี
 * ลำดับการตรวจสำคัญ: เบอร์มาก่อน ผู้เรียกที่ยื่นตั๋วของเบอร์อื่นจะได้ไม่รู้ว่าตั๋วใบนั้นยังไม่ถูกใช้
 */
export function checkTicket(
  claims: TicketClaims,
  expected: { phone: string; purpose: VerificationPurpose },
  storedJti: string | null,
): TicketCheck {
  if (claims.sub !== expected.phone) return { ok: false, reason: 'phone' };
  if (!isVerificationPurpose(claims.typ) || claims.typ !== expected.purpose) {
    return { ok: false, reason: 'purpose' };
  }
  if (!claims.jti || storedJti === null || claims.jti !== storedJti) {
    return { ok: false, reason: 'spent' };
  }
  return { ok: true };
}
