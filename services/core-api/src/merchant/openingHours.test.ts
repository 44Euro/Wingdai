import { describe, expect, it } from 'vitest';
import {
  effectiveIsOpen,
  isOpenAt,
  nextOpenAt,
  parseWeeklyHours,
  type WeeklyHours,
} from './openingHours';

/** เวลาไทยเขียนอ่านง่าย 2026-08-10 คือวันจันทร์ */
const bkk = (isoLocal: string) => new Date(`${isoLocal}+07:00`);

const NINE_TO_NINE: WeeklyHours = {
  mon: { open: '09:00', close: '21:00' },
  tue: { open: '09:00', close: '21:00' },
  sun: null,
};

describe('isOpenAt', () => {
  it('ตารางว่าง = เปิดตลอด ไม่ใช่ปิดตลอด', () => {
    // ร้านเดิมที่ยังไม่เคยตั้งเวลาต้องไม่หายจากแอปพร้อมกันทั้งหมด
    expect(isOpenAt({}, bkk('2026-08-10T03:00:00'))).toBe(true);
  });

  it('เปิดในช่วงเวลา ปิดนอกช่วง', () => {
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-10T12:00:00'))).toBe(true);
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-10T08:59:00'))).toBe(false);
  });

  it('นาทีที่ปิดพอดีถือว่าปิดแล้ว', () => {
    // 21:00 ตรงกดสั่งไม่ได้ ไม่งั้นครัวได้ใบตอนกำลังล้างเตา
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-10T20:59:00'))).toBe(true);
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-10T21:00:00'))).toBe(false);
  });

  it('วันที่ตั้งเป็น null คือหยุดทั้งวัน', () => {
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-09T12:00:00'))).toBe(false);
  });

  it('วันที่ไม่ได้ระบุไว้เลยก็คือหยุด', () => {
    // ต่างจาก "ตารางว่างทั้งอัน" ตั้งมาบางวันแปลว่าตั้งใจเลือกแล้ว
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-12T12:00:00'))).toBe(false);
  });

  it('ช่วงคร่อมเที่ยงคืนนับต่อไปถึงวันรุ่งขึ้น', () => {
    const latenight: WeeklyHours = { mon: { open: '18:00', close: '02:00' } };
    expect(isOpenAt(latenight, bkk('2026-08-10T23:30:00'))).toBe(true);
    expect(isOpenAt(latenight, bkk('2026-08-11T01:30:00'))).toBe(true);
    expect(isOpenAt(latenight, bkk('2026-08-11T02:30:00'))).toBe(false);
    expect(isOpenAt(latenight, bkk('2026-08-10T17:30:00'))).toBe(false);
  });

  it('ตัดสินตามเวลาไทย ไม่ใช่เวลาเครื่อง', () => {
    // 2026-08-10T02:00Z = 09:00 ตามเวลาไทย = เพิ่งเปิด
    expect(isOpenAt(NINE_TO_NINE, new Date('2026-08-10T02:00:00Z'))).toBe(true);
    expect(isOpenAt(NINE_TO_NINE, new Date('2026-08-10T01:59:00Z'))).toBe(false);
  });
});

describe('nextOpenAt', () => {
  it('บอกรอบเปิดของวันเดียวกันถ้ายังไม่ถึงเวลา', () => {
    expect(nextOpenAt(NINE_TO_NINE, bkk('2026-08-10T07:00:00'))).toEqual(
      bkk('2026-08-10T09:00:00'),
    );
  });

  it('เลยเวลาปิดแล้วข้ามไปวันที่เปิดวันถัดไป', () => {
    expect(nextOpenAt(NINE_TO_NINE, bkk('2026-08-10T22:00:00'))).toEqual(
      bkk('2026-08-11T09:00:00'),
    );
  });

  it('ข้ามวันหยุดไปหาวันที่เปิดจริง', () => {
    // เย็นวันอังคาร → วันพุธถึงเสาร์ไม่ได้ระบุ อาทิตย์ปิด → รอบถัดไปคือจันทร์
    expect(nextOpenAt(NINE_TO_NINE, bkk('2026-08-11T22:00:00'))).toEqual(
      bkk('2026-08-17T09:00:00'),
    );
  });

  it('เปิดอยู่แล้วหรือไม่มีตาราง = ไม่มีอะไรต้องบอก', () => {
    expect(nextOpenAt(NINE_TO_NINE, bkk('2026-08-10T12:00:00'))).toBeNull();
    expect(nextOpenAt({}, bkk('2026-08-10T03:00:00'))).toBeNull();
  });

  it('ปิดทุกวัน = ไม่มีรอบเปิด ไม่ใช่วนไม่รู้จบ', () => {
    expect(nextOpenAt({ mon: null, tue: null }, bkk('2026-08-10T12:00:00'))).toBeNull();
  });
});

describe('parseWeeklyHours', () => {
  it('อ่านรูปแบบเดิมในฐานไม่ออกก็คืนตารางว่าง ไม่โยน', () => {
    // แถวที่ seed ไว้เก็บ { mon_sun: [...] } ถ้าพังทั้งคำขอ ร้านเก่าจะสั่งไม่ได้เลย
    expect(parseWeeklyHours({ mon_sun: ['09:00', '21:00'] })).toEqual({});
    expect(parseWeeklyHours(null)).toEqual({});
    expect(parseWeeklyHours('เปิดทุกวัน')).toEqual({});
  });

  it('ทิ้งเฉพาะวันที่รูปแบบผิด ไม่ทิ้งทั้งตาราง', () => {
    expect(
      parseWeeklyHours({
        mon: { open: '09:00', close: '21:00' },
        tue: { open: '25:00', close: '21:00' },
        wed: null,
      }),
    ).toEqual({ mon: { open: '09:00', close: '21:00' }, wed: null });
  });
});

describe('effectiveIsOpen', () => {
  const base = {
    isOpen: true,
    isApproved: true,
    hours: NINE_TO_NINE,
    pausedUntil: null,
    at: bkk('2026-08-10T12:00:00'),
  };

  it('ครบทุกเงื่อนไข = เปิด', () => {
    expect(effectiveIsOpen(base)).toBe(true);
  });

  it('สวิตช์ที่ร้านกดปิด มีน้ำหนักเหนือตาราง', () => {
    expect(effectiveIsOpen({ ...base, isOpen: false })).toBe(false);
  });

  it('แต่สวิตช์เปิดไม่ทำให้เปิดนอกเวลา', () => {
    expect(effectiveIsOpen({ ...base, at: bkk('2026-08-10T03:00:00') })).toBe(false);
  });

  it('ยังไม่อนุมัติก็ไม่เปิด', () => {
    expect(effectiveIsOpen({ ...base, isApproved: false })).toBe(false);
  });

  it('กำลังพักอยู่ = ปิด · พ้นเวลาพักแล้วกลับมาเอง', () => {
    expect(effectiveIsOpen({ ...base, pausedUntil: bkk('2026-08-10T12:30:00') })).toBe(false);
    expect(effectiveIsOpen({ ...base, pausedUntil: bkk('2026-08-10T11:30:00') })).toBe(true);
  });
});
