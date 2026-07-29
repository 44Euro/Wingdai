/** เบอร์มือถือไทย: 10 หลัก ขึ้นต้น 06 / 08 / 09 — ตรงกับ CHECK ในตาราง accounts */
export const THAI_MOBILE = /^0[689][0-9]{8}$/;

/**
 * ทำเบอร์ให้อยู่ในรูปเดียวเสมอก่อนเทียบหรือบันทึก
 *
 * เบอร์คือ identifier สำหรับล็อกอิน (claude.md §4.2) ถ้าเก็บ "081-234-5678" กับ "+66812345678"
 * เป็นคนละแถว คนคนเดียวจะสมัครซ้ำได้ และ unique index ก็กันไม่อยู่
 *
 * คืนค่าที่ normalize แล้วเสมอ ต่อให้ผลลัพธ์ยังผิดรูป — ให้ชั้นตรวจ (zod / CHECK) เป็นคนตัดสิน
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  // +66 81 234 5678 → 0812345678 (รหัสประเทศแทนที่เลข 0 ตัวหน้า)
  if (digits.startsWith('66') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits.startsWith('0') ? digits : `0${digits}`;
}
