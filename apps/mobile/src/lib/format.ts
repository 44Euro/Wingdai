/** เวลาแบบ "เมื่อ 2 นาทีที่แล้ว" สำหรับรายการแจ้งเตือน (C20) */
export type RelativeTime = { key: string; count: number };

export function relativeTime(iso: string, now: number = Date.now()): RelativeTime {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return { key: 'common.time.justNow', count: 0 };
  if (minutes < 60) return { key: 'common.time.minutesAgo', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: 'common.time.hoursAgo', count: hours };
  const days = Math.floor(hours / 24);
  if (days === 1) return { key: 'common.time.yesterday', count: 1 };
  return { key: 'common.time.daysAgo', count: days };
}

/** แปลงสตางค์เป็นบาทสำหรับแสดงผล ลงตัวไม่โชว์ทศนิยม มีเศษโชว์ 2 ตำแหน่ง */
export function formatBaht(satang: number): string {
  const baht = satang / 100;
  const s = Number.isInteger(baht) ? String(baht) : baht.toFixed(2);
  return `฿${s}`;
}

/** คะแนนรีวิว คืน null เมื่อยังไม่มีใครรีวิว ให้จอซ่อนไปทั้งชิ้น */
export function ratingLabel(rating: number | null): string | null {
  return rating === null ? null : `★ ${rating.toFixed(1)}`;
}

/** ระยะทาง คืน null เมื่อยังไม่รู้ว่าผู้ใช้อยู่ไหน (ยังไม่ล็อกอิน หรือยังไม่มีที่อยู่) */
export function distanceLabel(distanceKm: number | null, kmSuffix: string): string | null {
  return distanceKm === null ? null : `${distanceKm} ${kmSuffix}`;
}

/** ต่อข้อมูลย่อยด้วย " " โดยข้ามส่วนที่ไม่มี */
export function joinMeta(...parts: (string | null | undefined)[]): string {
  return parts.filter((x): x is string => !!x).join(' · ');
}
