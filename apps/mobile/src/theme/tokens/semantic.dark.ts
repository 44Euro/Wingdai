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
  danger: '#F97066',
  success: '#75C48B',
} as const;
