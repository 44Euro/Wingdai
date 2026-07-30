import { repos } from '../../data';

/** การยืนยันเบอร์ไม่ใช่ "สถานะของแอป" จึงไม่อยู่ใน authStore */

/** `devCode` มีเฉพาะตอนเซิร์ฟเวอร์ไม่ใช่ production ยังไม่มีผู้ให้บริการ SMS (product-spec §11 ข้อ 3) */
export function requestOtp(phone: string): Promise<{ devCode?: string }> {
  return repos.auth.requestOtp(phone);
}

/** คืนตั๋วยืนยันเบอร์ที่ต้องยื่นตอนสมัคร โยน error ถ้ารหัสผิดหรือหมดอายุ */
export function verifyOtp(phone: string, code: string): Promise<string> {
  return repos.auth.verifyOtp(phone, code);
}
