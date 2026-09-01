import { BANGKOK_UTC_OFFSET_MINUTES } from './officeHours';

/** รายการหนึ่งวัน พร้อมยอดรวมของวันนั้น */
export type DayGroup<T> = {
  /** `YYYY-MM-DD` ตามเวลาไทย ใช้เป็น key ของ list และเป็นตัวจัดรูปวันที่ */
  key: string;
  items: T[];
  total: number;
};

/** วันที่ตามเวลาไทย ไม่ใช่ของเครื่องผู้ใช้ ใบเสร็จกับยอดรวมต้องตรงกับวันทำการของร้าน */
export function bangkokDayKey(at: Date): string {
  return new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
}

function bangkokDay(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return bangkokDayKey(at);
}

/**
 * จับรายการเป็นกลุ่มต่อวัน วันใหม่สุดขึ้นก่อน และในวันเดียวกันก็ใหม่สุดขึ้นก่อน
 * ใช้ร่วมกันทุกจอที่ดูย้อนหลัง แทนที่จะไล่รายการยาวเป็นพืดจนหาไม่เจอว่าวันไหนเป็นวันไหน
 */
export function groupByDay<T>(
  rows: readonly T[],
  whenOf: (row: T) => string,
  amountOf?: (row: T) => number,
): DayGroup<T>[] {
  const byDay = new Map<string, T[]>();

  for (const row of rows) {
    const when = whenOf(row);
    // รายการที่ไม่มีวันเวลาใช้ไม่ได้กับมุมมองรายวัน ข้ามดีกว่าโยนทิ้งทั้งจอ
    const day = typeof when === 'string' ? bangkokDay(when) : null;
    if (!day) continue;
    const bucket = byDay.get(day);
    if (bucket) bucket.push(row);
    else byDay.set(day, [row]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, items]) => ({
      key,
      items: [...items].sort((a, b) => (whenOf(a) < whenOf(b) ? 1 : -1)),
      total: amountOf ? items.reduce((sum, row) => sum + amountOf(row), 0) : 0,
    }));
}
