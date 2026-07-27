import React from 'react';
import { Pressable, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'teal' | 'ghostOnDark';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  testID?: string;
  /** ข้อความชิดขวา เช่น ยอดรวมบนปุ่มจ่ายเงิน (design: "View cart · 2 items" | "฿135") */
  trailingLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  testID,
  trailingLabel,
  style,
}: Props) {
  const { tokens, primitives: p } = useTheme();

  const fill: Record<ButtonVariant, string> = {
    primary: tokens.brandSolid,
    secondary: tokens.bgRaised,
    teal: tokens.tealSolid,
    ghostOnDark: 'rgba(255,255,255,0.12)',
  };
  const labelColor = variant === 'secondary' ? 'primary' : 'onBrand';
  const shadow =
    variant === 'primary' ? p.shadow.brand : variant === 'teal' ? p.shadow.teal : p.shadow.card;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: fill[variant],
          borderWidth: variant === 'secondary' ? 1.6 : 0,
          borderColor: tokens.borderSubtle,
          minHeight: 56,
          paddingHorizontal: p.space.xl,
          borderRadius: p.radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: trailingLabel ? 'space-between' : 'center',
          opacity: disabled ? 0.45 : 1,
          // design: ปุ่มหลักย่อลงเล็กน้อยตอนกด
          transform: [{ scale: pressed && !disabled ? 0.975 : 1 }],
        },
        !disabled && variant !== 'ghostOnDark' ? shadow : null,
        style,
      ]}
    >
      <Text variant="body" color={labelColor} bold>
        {label}
      </Text>
      {trailingLabel ? (
        <Text variant="body" color={labelColor} bold>
          {trailingLabel}
        </Text>
      ) : (
        <View />
      )}
    </Pressable>
  );
}
