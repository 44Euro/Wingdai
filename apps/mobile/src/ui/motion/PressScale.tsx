import React, { useRef } from 'react';
import { Animated, Easing, Pressable, type ViewStyle, type StyleProp } from 'react-native';

/** ปุ่มยุบตอนกด design แท็บบาร์ `transition:transform .14s` + `style-active="transform:scale(.82)"` */
export function PressScale({
  to = 0.82,
  duration = 140,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  style,
  children,
}: {
  to?: number;
  duration?: number;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'radio';
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number) =>
    Animated.timing(v, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPressIn={() => animate(to)}
      onPressOut={() => animate(1)}
      onPress={onPress}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>
    </Pressable>
  );
}
