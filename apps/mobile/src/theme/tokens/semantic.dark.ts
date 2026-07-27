import { primitives as p } from './primitives';

/**
 * โหมดมืดใช้ teal ของแบรนด์เป็นพื้นหลัง ไม่ใช่เทาดำกลาง ๆ
 * เพื่อให้โหมดมืดยังเป็น Wingdai
 */
export const semanticDark = {
  bgSurface: p.teal[900],
  bgRaised: p.teal[700],
  bgSunken: p.teal[900],
  textPrimary: p.cream,
  textMuted: '#C3D0CE',
  textFaint: '#9FB0AE',
  textOnBrand: p.white,
  textOnTeal: p.white,
  borderSubtle: '#1B5150',
  brandSolid: p.brand[700],
  brandAccent: p.brand[500],
  brandLink: p.brand[300], // บนพื้น teal เข้ม — 6.22:1; brand-700 มืดเกินไปบนพื้นนี้
  brandTint: '#3A2118',
  textOnBrandTint: p.brand[300],
  tealSolid: '#14514F',    // การ์ดเด่นต้องสว่างกว่าพื้นในโหมดมืด ไม่งั้นจมหาย
  tealTint: p.teal[700],
  textOnTealTint: p.cream,
  danger: '#F97066',
  success: '#7CE0B0',
} as const;
