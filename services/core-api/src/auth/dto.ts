import { z } from 'zod';
import { normalizePhone, THAI_MOBILE } from './phone';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './password';
import { VERIFICATION_PURPOSES } from './ticket';

const phone = z
  .string()
  .transform(normalizePhone)
  .refine((v) => THAI_MOBILE.test(v), 'เบอร์มือถือต้องเป็น 10 หลัก ขึ้นต้นด้วย 06 08 หรือ 09');

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`)
  .max(PASSWORD_MAX_LENGTH);

/**
 * วัตถุประสงค์เลือกตอนขอรหัส ไม่ใช่ตอนยืนยัน ข้อความ SMS จึงบอกได้ว่ารหัสนี้ใช้ทำอะไร
 * และตั๋วที่ออกให้ผูกกับงานเดียว เอาไปใช้ข้ามงานไม่ได้ (product-spec §4.2)
 */
export const OtpRequestSchema = z.object({
  phone,
  purpose: z.enum(VERIFICATION_PURPOSES).default('phone_verify'),
});
export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;

/**
 * ตั้งรหัสผ่านใหม่หลังยืนยันเบอร์ ไม่ต้องล็อกอิน — ต่างจาก `ChangePasswordSchema`
 * ที่บังคับรหัสเดิม เพราะคนที่ลืมรหัสผ่านย่อมกรอกรหัสเดิมไม่ได้
 */
export const ResetPasswordSchema = z.object({
  phone,
  verificationToken: z.string().min(1, 'ต้องยืนยันเบอร์ด้วยรหัส OTP ก่อน'),
  newPassword: password,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

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
    // จำกัดเป็น a-z 0-9 _ เพราะ username คือ identifier ที่ใช้ล็อกอิน (product-spec §4.2)
    .regex(/^[a-z0-9_]+$/, 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9 และ _'),
  password,
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  phone,
  /** เก็บไว้เป็นช่องทางรีเซ็ตรหัสเท่านั้น ไม่ใช่ identifier สำหรับล็อกอิน (product-spec §4.2) */
  email: z.email('อีเมลไม่ถูกต้อง').max(254).optional(),
  /** product-spec §4.1 admin สร้างผ่านช่องทางสาธารณะไม่ได้ และ merchant ไม่ใช่ประเภทบัญชี */
  accountType: z.enum(['user', 'rider']),
  /** ได้มาจาก /auth/otp/verify พิสูจน์ว่าเบอร์นี้ผ่านการยืนยันแล้ว */
  verificationToken: z.string().min(1, 'ต้องยืนยันเบอร์โทรก่อนสมัคร'),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const GoogleSignInSchema = z.object({
  /** id_token จาก GoogleSignin ฝั่งแอป ตรวจลายเซ็นที่เซิร์ฟเวอร์เท่านั้น ห้ามเชื่อฝั่งแอป */
  idToken: z.string().min(1),
});
export type GoogleSignInInput = z.infer<typeof GoogleSignInSchema>;

/** ฟอร์มสั้นหลังผ่าน Google ยังต้องมี username กับเบอร์ที่ยืนยันแล้ว (product-spec §4.2) */
export const GoogleRegisterSchema = z.object({
  googleToken: z.string().min(1),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร')
    .max(24)
    .regex(/^[a-z0-9_]+$/, 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9 และ _'),
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  phone,
  accountType: z.enum(['user', 'rider']),
  verificationToken: z.string().min(1, 'ต้องยืนยันเบอร์โทรก่อนสมัคร'),
});
export type GoogleRegisterInput = z.infer<typeof GoogleRegisterSchema>;

export const LoginSchema = z.object({
  /** username หรือเบอร์โทร อีเมลใช้ล็อกอินไม่ได้ (product-spec §4.2) */
  identifier: z.string().trim().min(1, 'กรุณากรอกชื่อผู้ใช้หรือเบอร์โทร').max(64),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** C21 แก้โปรไฟล์ มีแค่สองช่องโดยตั้งใจ */
export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  email: z.union([z.email('อีเมลไม่ถูกต้อง').max(254), z.literal('')]).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

/** เปลี่ยนรหัสผ่าน ต้องยืนยันรหัสเดิมเสมอ กันคนที่ยืมเครื่องไปตอนล็อกอินค้างไว้ */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านเดิม').max(PASSWORD_MAX_LENGTH),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/** เปลี่ยนเบอร์ ต้องผ่าน OTP ของเบอร์ใหม่ก่อน เบอร์คือช่องทางล็อกอินและกู้บัญชี */
export const ChangePhoneSchema = z.object({
  phone,
  verificationToken: z.string().min(1, 'ต้องยืนยันเบอร์ใหม่ด้วยรหัส OTP ก่อน'),
});
export type ChangePhoneInput = z.infer<typeof ChangePhoneSchema>;
