import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';

/**
 * โครงเปล่าของ stack ที่จะเติมเนื้อหาในแผนถัดไป
 * มีไว้เพื่อให้ทดสอบ routing ตาม capability ได้ตั้งแต่ตอนนี้
 */
export function PlaceholderStack({ name, testID }: { name: string; testID: string }) {
  const { tokens, primitives } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: primitives.space.xl,
      }}
    >
      <Text variant="h2">{name}</Text>
    </View>
  );
}
