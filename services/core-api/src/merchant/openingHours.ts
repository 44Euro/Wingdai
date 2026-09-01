import { BANGKOK_UTC_OFFSET_MINUTES } from '../support/officeHours';

/** เวลาเปิด-ปิดของร้าน (design M11) */

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** `null` = ปิดทั้งวัน เวลาเป็น `HH:MM` ตามเวลาไทย */
export type DayHours = { open: string; close: string } | null;
export type WeeklyHours = Partial<Record<Weekday, DayHours>>;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  if (!m) throw new Error(`เวลาต้องเป็นรูปแบบ HH:MM (ได้ "${hhmm}")`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** อ่านค่าจากคอลัมน์ jsonb ที่ไม่มีชนิดกำกับ ทิ้งของที่รูปแบบไม่ตรงแทนที่จะโยน */
export function parseWeeklyHours(raw: unknown): WeeklyHours {
  if (!raw || typeof raw !== 'object') return {};
  const out: WeeklyHours = {};
  for (const day of WEEKDAYS) {
    const value = (raw as Record<string, unknown>)[day];
    if (value === null) {
      out[day] = null;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const { open, close } = value as { open?: unknown; close?: unknown };
    if (typeof open !== 'string' || typeof close !== 'string') continue;
    if (!HHMM.test(open) || !HHMM.test(close)) continue;
    out[day] = { open, close };
  }
  return out;
}

/** ชื่อวันจากดัชนี 0–6 ที่วนรอบได้ เขียนแยกเพื่อไม่ให้ต้องใส่ `!` ทุกที่ที่ถอยไปวันก่อนหน้า */
function weekdayAt(index: number): Weekday {
  return WEEKDAYS[((index % 7) + 7) % 7] as Weekday;
}

/** วันและนาทีในวันตามเวลาไทย ณ เวลาที่ให้มา */
function bangkokParts(at: Date): { dayIndex: number; minutes: number } {
  const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  return {
    dayIndex: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** ร้านเปิดตามตารางไหม */
export function isOpenAt(hours: WeeklyHours, at: Date): boolean {
  if (Object.keys(hours).length === 0) return true;

  const { dayIndex, minutes } = bangkokParts(at);

  const today = hours[weekdayAt(dayIndex)];
  if (today) {
    const open = minutesOf(today.open);
    const close = minutesOf(today.close);
    if (close > open ? minutes >= open && minutes < close : minutes >= open) return true;
  }

  // ช่วงที่คร่อมเที่ยงคืนมาจากเมื่อวาน ตอนตีหนึ่งของวันอังคารยังอยู่ในรอบของวันจันทร์
  const yesterday = hours[weekdayAt(dayIndex - 1)];
  if (yesterday) {
    const open = minutesOf(yesterday.open);
    const close = minutesOf(yesterday.close);
    if (close <= open && minutes < close) return true;
  }

  return false;
}

/** รอบเปิดถัดไป `null` = ไม่มีวันไหนเปิดเลย หรือเปิดอยู่แล้ว */
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

/** นานที่สุดที่พักรับออเดอร์ได้ในครั้งเดียว เกินนี้คือปิดร้าน ไม่ใช่พัก */
export const MAX_PAUSE_MINUTES = 120;

/** ร้านรับออเดอร์ได้จริงไหม ณ ตอนนี้ รวมทุกเหตุผลไว้ที่เดียว */
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
