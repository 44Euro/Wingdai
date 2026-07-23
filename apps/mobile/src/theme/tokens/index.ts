export { primitives } from './primitives';
export type { Primitives } from './primitives';
export { contrastRatio, relativeLuminance } from './contrast';
export { semanticLight } from './semantic.light';
export { semanticDark } from './semantic.dark';

export type SemanticTokens = {
  bgSurface: string;
  bgRaised: string;
  textPrimary: string;
  textMuted: string;
  textOnBrand: string;
  borderSubtle: string;
  brandSolid: string;
  brandAccent: string;
  brandLink: string;
  danger: string;
  success: string;
};
