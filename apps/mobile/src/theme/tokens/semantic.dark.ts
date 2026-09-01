import { primitives as p } from './primitives';

/** โหมดมืด เทากลาง ความสูงของการ์ดมาจากพื้นผิวกับเส้นขอบ ไม่ใช่เงา (เงาดำบนพื้นมืดมองไม่เห็น) */
export const semanticDark = {
  bgSurface: p.night.bg,
  bgRaised: p.night.raised,
  bgSunken: p.night.sunken,
  textPrimary: p.night.text,
  textMuted: p.night.textMuted,
  textFaint: p.night.textFaint,
  textOnBrand: p.white,
  textOnTeal: p.white,
  textOnTealMuted: '#B9C6C4',
  /** 10% จางจนขอบการ์ดหายไปกับพื้น ซึ่งเป็นสัญญาณความสูงอย่างเดียวที่โหมดมืดเหลืออยู่ */
  borderSubtle: 'rgba(244,241,236,0.16)',
  /** เหมือนโหมดสว่าง ขาวบน #F15A22 ได้ 3.37:1 ไม่ผ่าน AA ไม่ว่าพื้นหลังจะเป็นอะไร */
  brandSolid: p.brand[700],
  brandAccent: p.brand[500],
  /** #F6A57E 9.22:1 บนพื้นมืด brand-800 มืดเกินไปบนพื้นนี้ */
  brandLink: p.brand[300],
  brandTint: '#3A2118',
  textOnBrandTint: p.brand[300],
  /** การ์ดประกาศใน C32 teal ที่สว่างกว่าพื้นแอป ไม่งั้นจมหาย */
  tealSolid: p.night.card,
  tealTint: '#1D3330',
  textOnTealTint: '#CFE0DC',
  /** C32 ให้แถบนำทางเป็นดำ ไม่ใช่ teal เหมือนโหมดสว่าง */
  navSurface: p.night.nav,
  /** C32 ให้ไอคอนกับป้ายของแท็บที่เลือกเป็นสีส้มตรง ๆ ไม่มีแผ่นรอง 5.84:1 */
  navActive: p.brand[500],
  navIdle: '#9AA0A0',
  danger: '#F97066',
  success: '#7CE0B0',
} as const;
