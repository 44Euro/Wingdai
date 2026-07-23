import { primitives as p } from './primitives';

/**
 * โหมดมืดใช้ teal ของแบรนด์เป็นพื้นหลัง ไม่ใช่เทาดำกลาง ๆ
 * เพื่อให้โหมดมืดยังเป็น Wingdai
 */
export const semanticDark = {
  bgSurface: p.teal900,
  bgRaised: '#0A4A4B',
  textPrimary: p.cream,
  textMuted: '#B8C9C9',
  textOnBrand: p.white,
  borderSubtle: '#0F5354',
  brandSolid: p.brand[700],
  brandAccent: p.brand[500],
  brandLink: p.brand[400], // ลิงก์ตัวอักษรบนพื้น teal เข้ม — brand-400 ผ่าน AA (5.01:1); brand-700 มืดเกินไปบนพื้นนี้
  danger: '#F97066',
  success: '#75C48B',
} as const;
