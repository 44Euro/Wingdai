import { z } from 'zod';
import { normalizePhone, THAI_MOBILE } from './phone';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './password';

const phone = z
  .string()
  .transform(normalizePhone)
  .refine((v) => THAI_MOBILE.test(v), 'เบอร์มือถือต้องเป็น 10 หลัก ขึ้นต้นด้วย 06 08 หรือ 09');

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`)
  .max(PASSWORD_MAX_LENGTH);

export const OtpRequestSchema = z.object({ phone });
export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;

export const OtpVerifySchema = z.object({
  phone,
  code: z.string().regex(/^[0-9]{6}$/, 'รหัสยืนยันเป็นตัวเลข 6 หลัก'),
});
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;

export const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร')
    .max(24)
    // จำกัดเป็น a-z 0-9 _ เพราะ username คือ identifier ที่ใช้ล็อกอิน (claude.md §4.2)
    // ปล่อยให้มีอักษรไทยหรือช่องว่างจะเจอปัญหาสระ/วรรณยุกต์คนละรูปแต่มองแล้วเหมือนกันเป๊ะ
    .regex(/^[a-z0-9_]+$/, 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9 และ _'),
  password,
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  phone,
  /** เก็บไว้เป็นช่องทางรีเซ็ตรหัสเท่านั้น ไม่ใช่ identifier สำหรับล็อกอิน (claude.md §4.2) */
  email: z.email('อีเมลไม่ถูกต้อง').max(254).optional(),
  /** claude.md §4.1 — admin สร้างผ่านช่องทางสาธารณะไม่ได้ และ merchant ไม่ใช่ประเภทบัญชี */
  accountType: z.enum(['user', 'rider']),
  /** ได้มาจาก /auth/otp/verify — พิสูจน์ว่าเบอร์นี้ผ่านการยืนยันแล้ว */
  verificationToken: z.string().min(1, 'ต้องยืนยันเบอร์โทรก่อนสมัคร'),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  /** username หรือเบอร์โทร — อีเมลใช้ล็อกอินไม่ได้ (claude.md §4.2) */
  identifier: z.string().trim().min(1, 'กรุณากรอกชื่อผู้ใช้หรือเบอร์โทร').max(64),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof LoginSchema>;
