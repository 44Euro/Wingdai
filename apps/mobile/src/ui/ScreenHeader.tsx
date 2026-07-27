import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { RoundButton } from './Surface';

/** หัวจอตาม design: ปุ่มย้อนกลับสี่เหลี่ยมมน 40px + ชื่อจอ (+ ช่องขวาไว้ใส่ปุ่มเสริม) */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  onDark,
  testID,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  onDark?: boolean;
  testID?: string;
}) {
  const { primitives: p } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: p.space.md,
        paddingHorizontal: p.space.screen,
        paddingTop: p.space.sm,
        paddingBottom: p.space.md,
      }}
    >
      {onBack ? (
        <RoundButton
          testID="btn-back"
          icon="chevronLeft"
          tone={onDark ? 'onDark' : 'surface'}
          onPress={onBack}
          accessibilityLabel="ย้อนกลับ"
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="h3" color={onDark ? 'onTeal' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={onDark ? 'onTeal' : 'muted'} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
