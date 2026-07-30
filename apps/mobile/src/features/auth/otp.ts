import { repos } from '../../data';

/**
 * การยืนยันเบอร์ไม่ใช่ "สถานะของแอป" จึงไม่อยู่ใน authStore
 * มันเป็นขั้นตอนชั่วคราวระหว่างสมัคร ตั๋วที่ได้ถูกส่งต่อผ่าน route param ไปจนถึงจอสมัคร
 * ถ้าเก็บลง store จะกลายเป็นข้อมูลค้างที่ต้องคอยล้าง และเสี่ยงถูกใช้ผิดจังหวะ
 */

/** `devCode` มีเฉพาะตอนเซิร์ฟเวอร์ไม่ใช่ production — ยังไม่มีผู้ให้บริการ SMS (claude.md §11 ข้อ 3) */
export function requestOtp(phone: string): Promise<{ devCode?: string }> {
  return repos.auth.requestOtp(phone);
}

/** คืนตั๋วยืนยันเบอร์ที่ต้องยื่นตอนสมัคร — โยน error ถ้ารหัสผิดหรือหมดอายุ */
export function verifyOtp(phone: string, code: string): Promise<string> {
  return repos.auth.verifyOtp(phone, code);
}
