import {
  effectiveIsOpen, isOpenAt, nextOpenAt, todayHours,
} from '../../src/lib/openingHours';
import type { WeeklyHours } from '../../src/data/types';

/** ไฟล์นี้เป็นสำเนาของ `services/core-api/src/merchant/openingHours.ts` */
const bkk = (isoLocal: string) => new Date(`${isoLocal}+07:00`);

const NINE_TO_NINE: WeeklyHours = {
  mon: { open: '09:00', close: '21:00' },
  tue: { open: '09:00', close: '21:00' },
  sun: null,
};

describe('openingHours (สำเนาฝั่งแอป)', () => {
  it('ตารางว่าง = เปิดตลอด', () => {
    expect(isOpenAt({}, bkk('2026-08-10T03:00:00'))).toBe(true);
  });

  it('เปิดในช่วง ปิดนอกช่วง และนาทีที่ปิดพอดีถือว่าปิดแล้ว', () => {
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-10T12:00:00'))).toBe(true);
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-10T08:59:00'))).toBe(false);
    expect(isOpenAt(NINE_TO_NINE, bkk('2026-08-10T21:00:00'))).toBe(false);
  });

  it('ช่วงคร่อมเที่ยงคืนนับต่อไปถึงวันรุ่งขึ้น', () => {
    const latenight: WeeklyHours = { mon: { open: '18:00', close: '02:00' } };
    expect(isOpenAt(latenight, bkk('2026-08-11T01:30:00'))).toBe(true);
    expect(isOpenAt(latenight, bkk('2026-08-11T02:30:00'))).toBe(false);
  });

  it('ตัดสินตามเวลาไทย ไม่ใช่เวลาเครื่อง', () => {
    expect(isOpenAt(NINE_TO_NINE, new Date('2026-08-10T02:00:00Z'))).toBe(true);
    expect(isOpenAt(NINE_TO_NINE, new Date('2026-08-10T01:59:00Z'))).toBe(false);
  });

  it('บอกรอบเปิดถัดไป และข้ามวันที่หยุด', () => {
    expect(nextOpenAt(NINE_TO_NINE, bkk('2026-08-10T07:00:00'))).toEqual(bkk('2026-08-10T09:00:00'));
    expect(nextOpenAt(NINE_TO_NINE, bkk('2026-08-11T22:00:00'))).toEqual(bkk('2026-08-17T09:00:00'));
    expect(nextOpenAt(NINE_TO_NINE, bkk('2026-08-10T12:00:00'))).toBeNull();
  });

  it('ปิดทุกวัน = ไม่มีรอบเปิด ไม่ใช่วนไม่รู้จบ', () => {
    expect(nextOpenAt({ mon: null, tue: null }, bkk('2026-08-10T12:00:00'))).toBeNull();
  });

  it('สวิตช์ปิดชนะตาราง แต่สวิตช์เปิดไม่ทำให้เปิดนอกเวลา', () => {
    const base = {
      isOpen: true, isApproved: true, hours: NINE_TO_NINE,
      pausedUntil: null, at: bkk('2026-08-10T12:00:00'),
    };
    expect(effectiveIsOpen(base)).toBe(true);
    expect(effectiveIsOpen({ ...base, isOpen: false })).toBe(false);
    expect(effectiveIsOpen({ ...base, at: bkk('2026-08-10T03:00:00') })).toBe(false);
    expect(effectiveIsOpen({ ...base, isApproved: false })).toBe(false);
    expect(effectiveIsOpen({ ...base, pausedUntil: bkk('2026-08-10T12:30:00') })).toBe(false);
    expect(effectiveIsOpen({ ...base, pausedUntil: bkk('2026-08-10T11:30:00') })).toBe(true);
  });

  it('todayHours คืนช่วงของวันนั้น และคืน null เมื่อยังไม่ได้ตั้งตาราง', () => {
    expect(todayHours(NINE_TO_NINE, bkk('2026-08-10T12:00:00'))).toEqual({
      open: '09:00', close: '21:00',
    });
    expect(todayHours(NINE_TO_NINE, bkk('2026-08-09T12:00:00'))).toBeNull();
    expect(todayHours({}, bkk('2026-08-10T12:00:00'))).toBeNull();
  });
});
