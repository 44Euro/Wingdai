import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type TextVariant =
  | 'display' | 'h1' | 'h2' | 'h3'
  | 'bodyLg' | 'body' | 'small' | 'caption' | 'kicker';

export type TextColor =
  | 'primary' | 'muted' | 'faint' | 'onBrand' | 'onTeal' | 'onTealMuted'
  | 'brand' | 'link' | 'onBrandTint' | 'onTealTint' | 'danger' | 'success';

type Props = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
  /** design ใช้ weight 700–800 กับ label/ราคา/ชื่อการ์ดแทบทุกจุด */
  bold?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Text({ variant = 'body', color = 'primary', bold, style, ...rest }: Props) {
  const { tokens, primitives } = useTheme();

  const colorMap: Record<TextColor, string> = {
    primary: tokens.textPrimary,
    muted: tokens.textMuted,
    faint: tokens.textFaint,
    onBrand: tokens.textOnBrand,
    onTeal: tokens.textOnTeal,
    onTealMuted: tokens.textOnTealMuted,
    brand: tokens.brandLink, // ตัวอักษรสีแบรนด์ต้องผ่าน AA — ห้ามใช้ brandAccent ตรงนี้
    link: tokens.brandLink,
    onBrandTint: tokens.textOnBrandTint,
    onTealTint: tokens.textOnTealTint,
    danger: tokens.danger,
    success: tokens.success,
  };

  const isHeading = variant === 'display' || variant === 'h1' || variant === 'h2' || variant === 'h3';
  const fontFamily = isHeading
    ? primitives.fontFamily.heading
    : bold || variant === 'kicker'
      ? primitives.fontFamily.bodyBold
      : primitives.fontFamily.body;

  return (
    <RNText
      // ปิดตายที่นี่ที่เดียวตาม Global Constraints
      allowFontScaling={false}
      style={[
        {
          fontSize: primitives.fontSize[variant],
          lineHeight: primitives.lineHeight[variant],
          color: colorMap[color],
          fontFamily,
        },
        // kicker/eyebrow ของ design: ตัวเล็ก หนา เว้นตัวอักษรกว้าง
        variant === 'kicker' && { letterSpacing: 1.4 },
        style,
      ]}
      {...rest}
    />
  );
}
