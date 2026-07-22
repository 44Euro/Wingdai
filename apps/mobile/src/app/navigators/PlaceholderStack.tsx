import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { RoleSwitcher } from '../RoleSwitcher';
import { useAuthStore } from '../../features/auth/authStore';
import { useTranslation } from 'react-i18next';

/**
 * โครงเปล่าของ stack ที่จะเติมเนื้อหาในแผนถัดไป
 * มีไว้เพื่อให้ทดสอบ routing ตาม capability ได้ตั้งแต่ตอนนี้
 */
export function PlaceholderStack({ name, testID }: { name: string; testID: string }) {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h2">{name}</Text>
      <RoleSwitcher />
      <Button
        testID="btn-logout"
        label={t('auth.pending.logout')}
        variant="secondary"
        onPress={() => logout()}
      />
    </View>
  );
}
