/**
 * เวลาแบบ "เมื่อ 2 นาทีที่แล้ว" สำหรับรายการแจ้งเตือน (C20)
 * คืน key + count แทนที่จะคืนข้อความ เพื่อให้ฟังก์ชันบริสุทธิ์และเทสต์ได้โดยไม่ต้องโหลด i18n
 */
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

/** แปลงสตางค์เป็นบาทสำหรับแสดงผล — ลงตัวไม่โชว์ทศนิยม มีเศษโชว์ 2 ตำแหน่ง */
export function formatBaht(satang: number): string {
  const baht = satang / 100;
  const s = Number.isInteger(baht) ? String(baht) : baht.toFixed(2);
  return `฿${s}`;
}
