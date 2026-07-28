import { primitives as p } from './primitives';

/**
 * โหมดมืดตามจอ C32 ของ design (2026-07-28)
 *
 * เดิมโหมดมืดใช้พื้น teal ทั้งจอ — C32 เปลี่ยนเป็นพื้นดำอมเขียว แล้วให้ teal
 * เหลือบทบาทเป็นการ์ดเด่น (การ์ดประกาศ) อย่างเดียว ทำให้การ์ดลอยขึ้นมาชัดกว่าเดิม
 */
export const semanticDark = {
  bgSurface: p.night.bg,
  bgRaised: p.night.raised,
  bgSunken: p.night.bg,
  textPrimary: p.night.text,
  textMuted: p.night.textMuted,
  textFaint: p.night.textFaint,
  textOnBrand: p.white,
  textOnTeal: p.white,
  borderSubtle: 'rgba(244,241,236,0.10)',
  /** เหมือนโหมดสว่าง — ขาวบน #F15A22 ได้ 3.37:1 ไม่ผ่าน AA ไม่ว่าพื้นหลังจะเป็นอะไร */
  brandSolid: p.brand[700],
  brandAccent: p.brand[500],
  /** #F6A57E — 8.97:1 บนพื้นมืด · brand-800 มืดเกินไปบนพื้นนี้ */
  brandLink: p.brand[300],
  brandTint: '#3A2118',
  textOnBrandTint: p.brand[300],
  /** การ์ดประกาศใน C32 — teal ที่สว่างกว่าพื้นแอป ไม่งั้นจมหาย */
  tealSolid: p.night.card,
  tealTint: p.night.raised,
  textOnTealTint: p.night.text,
  /** C32 ให้แถบนำทางเป็นดำ ไม่ใช่ teal เหมือนโหมดสว่าง */
  navSurface: p.night.nav,
  /** C32 ให้ไอคอนกับป้ายของแท็บที่เลือกเป็นสีส้มตรง ๆ ไม่มีแผ่นรอง — 5.82:1 */
  navActive: p.brand[500],
  navIdle: p.night.textFaint,
  danger: '#F97066',
  success: '#7CE0B0',
} as const;
