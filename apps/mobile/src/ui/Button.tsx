import React from 'react';
import { Pressable, View, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'teal' | 'ghostOnDark';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** กำลังรอเซิร์ฟเวอร์ กดซ้ำไม่ได้และเห็นได้ว่ากดติดแล้ว */
  loading?: boolean;
  testID?: string;
  /** ข้อความชิดขวา เช่น ยอดรวมบนปุ่มจ่ายเงิน (design: "View cart 2 items" | "฿135") */
  trailingLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
  trailingLabel,
  style,
}: Props) {
  const { tokens, primitives: p } = useTheme();
  const blocked = disabled || loading;

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
      disabled={blocked}
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
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
          opacity: blocked ? 0.45 : 1,
          // design: ปุ่มหลักย่อลงเล็กน้อยตอนกด
          transform: [{ scale: pressed && !blocked ? 0.975 : 1 }],
        },
        !blocked && variant !== 'ghostOnDark' ? shadow : null,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
        {loading ? <ActivityIndicator color={tokens.textOnBrand} /> : null}
        <Text variant="body" color={labelColor} bold>
          {label}
        </Text>
      </View>
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
