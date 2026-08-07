import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Icon } from '../../../ui/Icon';

/** ดาวห้าดวง (design C11 C36 M9) */
export function Stars({
  value,
  onChange,
  size = 20,
  testID,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
  testID?: string;
}) {
  const { tokens, primitives: p } = useTheme();

  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: onChange ? p.space.xs : 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <Icon
            name="star"
            size={size}
            filled={filled}
            // ดาวที่ยังไม่ได้เลือกใช้สีจาง ไม่ใช่ซ่อน ต้องเห็นว่ามีทั้งหมดกี่ดวง
            color={filled ? tokens.brandAccent : tokens.textFaint}
          />
        );

        if (!onChange) return <View key={n}>{star}</View>;

        return (
          <Pressable
            key={n}
            testID={testID ? `${testID}-${n}` : undefined}
            accessibilityRole="button"
            accessibilityLabel={`${n} ดาว`}
            hitSlop={6}
            onPress={() => onChange(n)}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
