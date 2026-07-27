import React, { useState } from 'react';
import { View, TextInput, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/**
 * ช่องกรอกตาม design (wd-in): พื้นขาว มุม 16 เงานุ่ม
 * โฟกัสแล้วขอบเปลี่ยนเป็นสีแบรนด์ (เส้นขอบไม่ใช่ตัวหนังสือ จึงใช้ brandAccent ได้)
 */
export function Input({
  style,
  containerStyle,
  ...rest
}: TextInputProps & { containerStyle?: StyleProp<ViewStyle> }) {
  const { tokens, primitives: p } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      <TextInput
        allowFontScaling={false}
        placeholderTextColor={tokens.textFaint}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: tokens.bgRaised,
            borderWidth: 1.6,
            borderColor: focused ? tokens.brandAccent : 'transparent',
            borderRadius: p.radius.md,
            paddingHorizontal: p.space.lg,
            paddingVertical: 14,
            minHeight: 52,
            color: tokens.textPrimary,
            fontFamily: p.fontFamily.bodyBold,
            fontSize: p.fontSize.body,
          },
          p.shadow.card,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

/** ป้ายกำกับเหนือช่องกรอก — kicker ตัวเล็กหนาเว้นตัวอักษรกว้าง */
export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { primitives: p } = useTheme();
  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: p.space.xs, marginBottom: p.space.sm }}>
        <Text variant="kicker" color="muted">
          {label}
        </Text>
        {hint ? (
          <Text variant="kicker" color="faint">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
