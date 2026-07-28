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
  borderSubtle: string;
  brandSolid: string;
  brandAccent: string;
  brandLink: string;
  brandTint: string;
  textOnBrandTint: string;
  tealSolid: string;
  tealTint: string;
  textOnTealTint: string;
  /** พื้นแถบนำทางลอย — teal ในโหมดสว่าง ดำในโหมดมืด (C32) */
  navSurface: string;
  navActive: string;
  navIdle: string;
  danger: string;
  success: string;
};
