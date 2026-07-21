import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type TextVariant =
  | 'display' | 'h1' | 'h2' | 'h3'
  | 'bodyLg' | 'body' | 'small' | 'caption';

export type TextColor = 'primary' | 'muted' | 'onBrand' | 'brand';

type Props = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
  style?: StyleProp<TextStyle>;
};

export function Text({ variant = 'body', color = 'primary', style, ...rest }: Props) {
  const { tokens, primitives } = useTheme();

  const colorMap: Record<TextColor, string> = {
    primary: tokens.textPrimary,
    muted: tokens.textMuted,
    onBrand: tokens.textOnBrand,
    brand: tokens.brandSolid, // brand-700 — ผ่าน AA ห้ามใช้ brandAccent ตรงนี้
  };

  const isHeading = variant === 'display' || variant === 'h1' || variant === 'h2' || variant === 'h3';

  return (
    <RNText
      // ปิดตายที่นี่ที่เดียวตาม Global Constraints
      allowFontScaling={false}
      style={[
        {
          fontSize: primitives.fontSize[variant],
          lineHeight: primitives.lineHeight[variant],
          color: colorMap[color],
          fontFamily: isHeading ? primitives.fontFamily.heading : primitives.fontFamily.body,
        },
        style,
      ]}
      {...rest}
    />
  );
}
