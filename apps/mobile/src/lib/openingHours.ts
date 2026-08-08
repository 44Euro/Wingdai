import { BANGKOK_UTC_OFFSET_MINUTES } from './officeHours';
import type { DayHours, Weekday, WeeklyHours } from '../data/types';

/** เวลาเปิด-ปิดของร้าน (design M11) สำเนาของ `services/core-api/src/merchant/openingHours.ts` */

export const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function weekdayAt(index: number): Weekday {
  return WEEKDAYS[((index % 7) + 7) % 7]!;
}

function bangkokParts(at: Date) {
  const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  return {
    dayIndex: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** ตารางว่าง = เปิดตลอด ไม่ใช่ปิดตลอด ร้านที่ยังไม่เคยตั้งเวลาต้องไม่หายจากแอป */
export function isOpenAt(hours: WeeklyHours, at: Date): boolean {
  if (Object.keys(hours).length === 0) return true;
  const { dayIndex, minutes } = bangkokParts(at);

  const today = hours[weekdayAt(dayIndex)];
  if (today) {
    const open = minutesOf(today.open);
    const close = minutesOf(today.close);
    if (close > open ? minutes >= open && minutes < close : minutes >= open) return true;
  }

  const yesterday = hours[weekdayAt(dayIndex - 1)];
  if (yesterday) {
    const open = minutesOf(yesterday.open);
    const close = minutesOf(yesterday.close);
    if (close <= open && minutes < close) return true;
  }

  return false;
}

/** รอบเปิดถัดไป `null` = เปิดอยู่แล้ว หรือไม่มีวันไหนเปิดเลย */
export function nextOpenAt(hours: WeeklyHours, at: Date): Date | null {
  if (Object.keys(hours).length === 0) return null;
  if (isOpenAt(hours, at)) return null;
  const { dayIndex, minutes } = bangkokParts(at);

  for (let ahead = 0; ahead < 7; ahead += 1) {
    const day = hours[weekdayAt(dayIndex + ahead)];
    if (!day) continue;
    const open = minutesOf(day.open);
    if (ahead === 0 && open <= minutes) continue;

    const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
    shifted.setUTCDate(shifted.getUTCDate() + ahead);
    shifted.setUTCHours(Math.floor(open / 60), open % 60, 0, 0);
    return new Date(shifted.getTime() - BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  }
  return null;
}

export const MAX_PAUSE_MINUTES = 120;

export function effectiveIsOpen(input: {
  isOpen: boolean;
  isApproved: boolean;
  hours: WeeklyHours;
  pausedUntil: Date | null;
  at: Date;
}): boolean {
  if (!input.isApproved || !input.isOpen) return false;
  if (input.pausedUntil && input.pausedUntil.getTime() > input.at.getTime()) return false;
  return isOpenAt(input.hours, input.at);
}

/** ช่วงเวลาของวันนี้ไว้เขียนหัวจอ `null` = วันนี้หยุด หรือไม่ได้ตั้งตาราง */
export function todayHours(hours: WeeklyHours, at: Date): DayHours {
  if (Object.keys(hours).length === 0) return null;
  return hours[weekdayAt(bangkokParts(at).dayIndex)] ?? null;
}
