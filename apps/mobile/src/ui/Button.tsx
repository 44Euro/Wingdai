import React from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  testID,
  style,
}: Props) {
  const { tokens, primitives } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          // brandSolid = brand-700 เท่านั้น — brand-500 ไม่ผ่าน contrast กับตัวหนังสือ
          backgroundColor: isPrimary ? tokens.brandSolid : 'transparent',
          borderWidth: isPrimary ? 0 : 1,
          borderColor: tokens.brandSolid,
          minHeight: 48,
          paddingHorizontal: primitives.space.xl,
          borderRadius: primitives.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text variant="body" color={isPrimary ? 'onBrand' : 'brand'}>
        {label}
      </Text>
    </Pressable>
  );
}
