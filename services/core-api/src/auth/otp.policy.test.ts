import { describe, it, expect } from 'vitest';
import {
  decideSend,
  isExpired,
  attemptsExhausted,
  MAX_SENDS_PER_WINDOW,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  SEND_WINDOW_MS,
} from './otp.policy';

const T0 = new Date('2026-07-30T10:00:00Z');
const at = (msFromT0: number) => new Date(T0.getTime() + msFromT0);

describe('กติกาการส่งรหัส OTP', () => {
  it('เบอร์ที่ไม่เคยขอ ส่งได้ทันที', () => {
    expect(decideSend(null, T0)).toEqual({ allowed: true, sendCount: 1, windowStartedAt: T0 });
  });

  it('กดขอซ้ำก่อนครบ cooldown ถูกปฏิเสธ พร้อมบอกว่าอีกกี่วินาที', () => {
    const d = decideSend({ lastSentAt: T0, sendCount: 1, windowStartedAt: T0 }, at(20_000));
    expect(d).toMatchObject({ allowed: false, reason: 'cooldown', retryAfterSeconds: 40 });
  });

  it('พ้น cooldown แล้วส่งได้ และตัวนับเดินขึ้นทีละหนึ่ง', () => {
    const d = decideSend({ lastSentAt: T0, sendCount: 1, windowStartedAt: T0 }, at(RESEND_COOLDOWN_MS));
    expect(d).toEqual({ allowed: true, sendCount: 2, windowStartedAt: T0 });
  });

  it('เต็มโควตาในหน้าต่างเดียวกันแล้วส่งไม่ได้ แม้พ้น cooldown', () => {
    const d = decideSend(
      { lastSentAt: at(5 * 60_000), sendCount: MAX_SENDS_PER_WINDOW, windowStartedAt: T0 },
      at(10 * 60_000),
    );
    expect(d).toMatchObject({ allowed: false, reason: 'quota' });
    // บอกเวลาที่ต้องรอจริง ๆ ไม่ใช่ตัวเลขคงที่ที่ผู้ใช้รอแล้วยังโดนปฏิเสธซ้ำ
    expect((d as { retryAfterSeconds: number }).retryAfterSeconds).toBe(50 * 60);
  });

  it('ข้ามหน้าต่างแล้วโควตารีเซ็ต', () => {
    const d = decideSend(
      { lastSentAt: T0, sendCount: MAX_SENDS_PER_WINDOW, windowStartedAt: T0 },
      at(SEND_WINDOW_MS),
    );
    expect(d).toEqual({ allowed: true, sendCount: 1, windowStartedAt: at(SEND_WINDOW_MS) });
  });

  /** เคสที่พลาดง่ายที่สุด: cooldown ต้องมาก่อนการรีเซ็ตหน้าต่าง */
  it('cooldown ยังคุมอยู่แม้หน้าต่างจะหมดอายุพอดี', () => {
    const d = decideSend(
      { lastSentAt: at(SEND_WINDOW_MS - 1_000), sendCount: 1, windowStartedAt: T0 },
      at(SEND_WINDOW_MS),
    );
    expect(d).toMatchObject({ allowed: false, reason: 'cooldown' });
  });
});

describe('อายุรหัสและจำนวนครั้งที่กรอกผิด', () => {
  it('หมดอายุนับตั้งแต่วินาทีที่ถึงเวลาพอดี', () => {
    expect(isExpired(T0, at(-1))).toBe(false);
    expect(isExpired(T0, T0)).toBe(true);
  });

  it('กรอกผิดครบเพดานแล้วรหัสชุดนั้นใช้ไม่ได้อีก', () => {
    expect(attemptsExhausted(MAX_ATTEMPTS - 1)).toBe(false);
    expect(attemptsExhausted(MAX_ATTEMPTS)).toBe(true);
  });
});
