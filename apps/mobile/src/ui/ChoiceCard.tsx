import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { IconChip } from './Surface';

/** การ์ดตัวเลือกใหญ่ตาม A5: ชิปไอคอน 54 + หัวข้อ + คำอธิบาย + วงกลมติ๊กถูกด้านขวา */
export function ChoiceCard({
  testID,
  title,
  description,
  icon,
  tone = 'brand',
  selected,
  onPress,
}: {
  testID?: string;
  title: string;
  description: string;
  icon: IconName;
  tone?: 'brand' | 'teal' | 'neutral';
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: p.space.lg,
          backgroundColor: tokens.bgRaised,
          borderRadius: p.radius.xl,
          borderWidth: selected ? 2.5 : 1.6,
          borderColor: selected ? tokens.brandAccent : tokens.borderSubtle,
          padding: p.space.xl,
          opacity: pressed ? 0.9 : 1,
        },
        p.shadow.card,
      ]}
    >
      <IconChip name={icon} tone={tone} size={54} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyLg" bold>
          {title}
        </Text>
        <Text variant="caption" color="muted" style={{ marginTop: 3 }}>
          {description}
        </Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: selected ? 0 : 2,
          borderColor: tokens.borderSubtle,
          backgroundColor: selected ? tokens.brandAccent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Icon name="check" color={tokens.textOnBrand} size={14} strokeWidth={3.4} /> : null}
      </View>
    </Pressable>
  );
}
