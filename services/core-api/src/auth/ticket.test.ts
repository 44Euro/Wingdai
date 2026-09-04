import { describe, it, expect } from 'vitest';
import { checkTicket, VERIFICATION_PURPOSES, type TicketClaims } from './ticket';

const PHONE = '0812345678';
const JTI = 'a1b2c3d4-0000-4000-8000-000000000001';

const claims = (over: Partial<TicketClaims> = {}): TicketClaims => ({
  sub: PHONE,
  typ: 'phone_verify',
  jti: JTI,
  ...over,
});

describe('checkTicket', () => {
  it('ตั๋วที่ตรงทั้งเบอร์ วัตถุประสงค์ และยังไม่ถูกใช้ ผ่าน', () => {
    expect(checkTicket(claims(), { phone: PHONE, purpose: 'phone_verify' }, JTI))
      .toEqual({ ok: true });
  });

  it('เบอร์ไม่ตรงกับที่กรอกมา ไม่ผ่าน', () => {
    expect(checkTicket(claims(), { phone: '0899999999', purpose: 'phone_verify' }, JTI))
      .toEqual({ ok: false, reason: 'phone' });
  });

  /**
   * หัวใจของตั๋วใบนี้: ตั๋วที่ออกตอนสมัครสมาชิกต้องเอาไปรีเซ็ตรหัสผ่านไม่ได้
   * ปลายทางรีเซ็ตไม่ต้องล็อกอินและยกบัญชีให้เลย ตั๋วอเนกประสงค์จึงเป็นกุญแจผี
   */
  it('ตั๋วที่ออกเพื่อสมัครสมาชิก เอาไปรีเซ็ตรหัสผ่านไม่ได้', () => {
    expect(checkTicket(claims({ typ: 'phone_verify' }), { phone: PHONE, purpose: 'password_reset' }, JTI))
      .toEqual({ ok: false, reason: 'purpose' });
  });

  it('ตั๋วที่ออกเพื่อรีเซ็ตรหัสผ่าน เอาไปสมัครสมาชิกก็ไม่ได้', () => {
    expect(checkTicket(claims({ typ: 'password_reset' }), { phone: PHONE, purpose: 'phone_verify' }, JTI))
      .toEqual({ ok: false, reason: 'purpose' });
  });

  /** หนึ่ง OTP ต้องรีเซ็ตได้ครั้งเดียว ไม่ใช่ไม่จำกัดครั้งตลอดอายุตั๋ว */
  it('ตั๋วที่ถูกใช้ไปแล้ว ใช้ซ้ำไม่ได้', () => {
    expect(checkTicket(claims(), { phone: PHONE, purpose: 'phone_verify' }, null))
      .toEqual({ ok: false, reason: 'spent' });
  });

  it('ตั๋วคนละใบกับที่ฐานจำไว้ ใช้ไม่ได้ — ขอรหัสใหม่แล้วใบเก่าต้องตาย', () => {
    const older = 'a1b2c3d4-0000-4000-8000-000000000002';
    expect(checkTicket(claims({ jti: older }), { phone: PHONE, purpose: 'phone_verify' }, JTI))
      .toEqual({ ok: false, reason: 'spent' });
  });

  it('ตั๋วที่ไม่มี jti ถือว่าใช้ไม่ได้ ไม่ใช่ผ่านฟรี', () => {
    const legacy = { sub: PHONE, typ: 'phone_verify' } as TicketClaims;
    expect(checkTicket(legacy, { phone: PHONE, purpose: 'phone_verify' }, JTI))
      .toEqual({ ok: false, reason: 'spent' });
  });

  it('วัตถุประสงค์ที่ไม่รู้จักไม่ผ่าน แม้เบอร์กับ jti จะตรง', () => {
    const bogus = { sub: PHONE, typ: 'admin_takeover', jti: JTI } as unknown as TicketClaims;
    expect(checkTicket(bogus, { phone: PHONE, purpose: 'phone_verify' }, JTI))
      .toEqual({ ok: false, reason: 'purpose' });
  });

  it('เบอร์ผิดถูกรายงานก่อนเรื่องอื่น ผู้เรียกจะได้ไม่รู้ว่าตั๋วใบนั้นมีอยู่จริงไหม', () => {
    expect(checkTicket(claims({ typ: 'password_reset' }), { phone: '0899999999', purpose: 'phone_verify' }, null))
      .toEqual({ ok: false, reason: 'phone' });
  });
});

describe('VERIFICATION_PURPOSES', () => {
  it('มีสองวัตถุประสงค์ เพิ่มใหม่ต้องกลับมาคิดเรื่องความปลอดภัยที่นี่', () => {
    expect([...VERIFICATION_PURPOSES]).toEqual(['phone_verify', 'password_reset']);
  });
});
