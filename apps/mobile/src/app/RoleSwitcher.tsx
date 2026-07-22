import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../ui/Button';
import { useAuthStore } from '../features/auth/authStore';
import type { Capability } from '../data/types';

const LABEL_KEY: Record<Capability, string> = {
  customer: 'roleSwitcher.customer',
  merchant: 'roleSwitcher.merchant',
  rider: 'roleSwitcher.rider',
  admin: 'roleSwitcher.admin',
};

export function RoleSwitcher() {
  const { t } = useTranslation();
  const { primitives } = useTheme();
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);
  const setActive = useAuthStore((s) => s.setActiveCapability);

  // มีบทบาทเดียวก็ไม่มีอะไรให้สลับ
  if (capabilities.length < 2) return null;

  return (
    <View
      testID="role-switcher"
      style={{ flexDirection: 'row', gap: primitives.space.sm, padding: primitives.space.lg }}
    >
      {capabilities.map((cap) => (
        <Button
          key={cap}
          testID={`role-btn-${cap}`}
          label={t(LABEL_KEY[cap])}
          variant={cap === active ? 'primary' : 'secondary'}
          onPress={() => setActive(cap)}
        />
      ))}
    </View>
  );
}
