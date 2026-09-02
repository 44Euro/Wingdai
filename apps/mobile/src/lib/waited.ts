import type { TFunction } from 'i18next';

/**
 * ระยะเวลาที่ออเดอร์ค้างอยู่ เขียนให้อ่านออกโดยไม่ต้องนับเอง และเปลี่ยนภาษาตามที่ผู้ใช้ตั้งไว้
 *
 * เซิร์ฟเวอร์เคยประกอบประโยคนี้เป็นภาษาไทยตายตัวแล้วส่งมาทั้งก้อน
 * ตั้งแอปเป็นอังกฤษแล้วจอผู้ดูแลระบบจึงยังขึ้นไทยอยู่ประโยคเดียวกลางหน้า
 * ตอนนี้เซิร์ฟเวอร์ส่งมาแค่ชนิดกับจำนวนนาที แอปเป็นคนประกอบเอง
 */
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function waitedLabel(minutes: number, t: TFunction): string {
  const total = Math.max(0, Math.round(minutes));

  if (total < MINUTES_PER_HOUR) return t('admin.waited.minutes', { count: total });

  if (total < MINUTES_PER_DAY) {
    const hours = Math.floor(total / MINUTES_PER_HOUR);
    const rest = total % MINUTES_PER_HOUR;
    return rest === 0
      ? t('admin.waited.hours', { count: hours })
      : t('admin.waited.hoursMinutes', { hours, minutes: rest });
  }

  const days = Math.floor(total / MINUTES_PER_DAY);
  const hours = Math.floor((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  return hours === 0
    ? t('admin.waited.days', { count: days })
    : t('admin.waited.daysHours', { days, hours });
}
