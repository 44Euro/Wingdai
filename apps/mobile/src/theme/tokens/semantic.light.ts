import { primitives as p } from './primitives';

export const semanticLight = {
  bgSurface: p.cream,
  bgRaised: p.white,
  textPrimary: p.teal900,
  textMuted: p.neutral[700],
  textOnBrand: p.white,
  borderSubtle: p.neutral[100],
  brandSolid: p.brand[700],  // ปุ่ม — ผ่าน AA กับตัวหนังสือขาว
  brandAccent: p.brand[500], // กราฟิกเท่านั้น ห้ามใส่ตัวหนังสือทับ
  danger: p.danger,
  success: p.success,
} as const;
