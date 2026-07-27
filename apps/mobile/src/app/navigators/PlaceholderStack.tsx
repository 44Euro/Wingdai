import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { RoleSwitcher } from '../RoleSwitcher';
import { useAuthStore } from '../../features/auth/authStore';

/**
 * โครงเปล่าของ stack ที่จะเติมเนื้อหาในแผนถัดไป
 * มีไว้เพื่อให้ทดสอบ routing ตาม capability ได้ตั้งแต่ตอนนี้
 */
export function PlaceholderStack({ name, testID }: { name: string; testID: string }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView testID={testID} edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44, gap: p.space.md }}>
        <View
          style={[
            {
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: tokens.bgRaised,
              alignItems: 'center',
              justifyContent: 'center',
            },
            p.shadow.raised,
          ]}
        >
          <Icon name="store" color={tokens.textFaint} size={50} strokeWidth={1.7} />
        </View>
        <Text variant="h2" style={{ marginTop: p.space.sm, textAlign: 'center' }}>{name}</Text>
      </View>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, gap: p.space.md }}>
        <RoleSwitcher />
        <Button
          testID="btn-logout"
          label={t('auth.pending.logout')}
          variant="secondary"
          onPress={() => logout()}
        />
      </View>
    </SafeAreaView>
  );
}
