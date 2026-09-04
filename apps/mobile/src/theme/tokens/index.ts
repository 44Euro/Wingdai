export { primitives } from './primitives';
export type { Primitives } from './primitives';
export { contrastRatio, relativeLuminance } from './contrast';
export { semanticLight } from './semantic.light';
export { semanticDark } from './semantic.dark';

export type SemanticTokens = {
  bgSurface: string;
  bgRaised: string;
  bgSunken: string;
  textPrimary: string;
  textMuted: string;
  textFaint: string;
  textOnBrand: string;
  textOnTeal: string;
  /** บรรทัดรองบนการ์ด teal จางกว่า textOnTeal แต่ยังผ่าน AA */
  textOnTealMuted: string;
  borderSubtle: string;
  brandSolid: string;
  brandAccent: string;
  brandLink: string;
  brandTint: string;
  textOnBrandTint: string;
  tealSolid: string;
  tealTint: string;
  textOnTealTint: string;
  /** พื้นแถบนำทางลอย teal ในโหมดสว่าง ดำในโหมดมืด (C32) */
  navSurface: string;
  navActive: string;
  navIdle: string;
  danger: string;
  success: string;
  /**
   * พื้นผิวที่ตั้งใจให้เป็นสีอ่อนทั้งสองโหมด: หน้าบัตรจำลอง (C19) และแผ่นรอง QR (C5, M12)
   * บัตรจริงกับกระดาษ QR เป็นสีอ่อนเสมอ ไม่ได้พลิกตามธีมของแอป
   */
  surfaceFixedLight: string;
  textOnFixedLight: string;
  textOnFixedLightMuted: string;
  /** ข้อความผิดพลาดบนพื้น teal เข้ม `danger` ปกติจมกับพื้น */
  dangerOnTeal: string;
};
