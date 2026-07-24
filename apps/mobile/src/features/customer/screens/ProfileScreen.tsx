import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useAuthStore } from '../../auth/authStore';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView testID="screen-profile" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg }}>
        <Text variant="h1">{t('customer.profile.title')}</Text>

        <View style={{ backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg, gap: p.space.xs }}>
          <Text variant="h3">{account?.fullName ?? ''}</Text>
          <Text variant="small" color="muted">@{account?.username ?? ''}</Text>
          <Text variant="small" color="muted">{t('customer.profile.phone')}: {account?.phone ?? ''}</Text>
        </View>

        <RoleSwitcher />

        <Button testID="btn-logout" label={t('customer.profile.logout')} variant="secondary" onPress={() => logout()} />
      </ScrollView>
    </SafeAreaView>
  );
}
