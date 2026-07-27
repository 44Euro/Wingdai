import { primitives as p } from './primitives';

export const semanticLight = {
  bgSurface: p.cream,          // พื้นแอป (warm off-white)
  bgRaised: p.white,           // การ์ด/ชีต/อินพุต
  bgSunken: p.cream,           // ร่องใน (แถบ stepper บนการ์ดขาว)
  textPrimary: p.ink[100],
  textMuted: p.ink[70],
  textFaint: p.ink[50],
  textOnBrand: p.white,
  textOnTeal: p.white,
  borderSubtle: p.neutral[100],
  brandSolid: p.brand[700],    // พื้นปุ่ม/ลิงก์ — ผ่าน AA กับตัวหนังสือขาว
  brandAccent: p.brand[500],   // กราฟิกเท่านั้น ห้ามใส่ตัวหนังสือทับ
  brandLink: p.brand[800],     // ตัวอักษรสีแบรนด์บนครีม/ขาว — brand-700 ได้แค่ 4.27:1 จึงต้องใช้ 800 (5.34:1)
  brandTint: p.brand[50],
  textOnBrandTint: p.brand[800],
  tealSolid: p.teal[500],      // การ์ด/จอเด่นสีเข้ม
  tealTint: p.teal[100],
  textOnTealTint: p.teal[500],
  danger: p.danger,
  success: p.success,
} as const;
