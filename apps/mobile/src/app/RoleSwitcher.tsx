import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { useAuthStore } from '../features/auth/authStore';
import type { Capability } from '../data/types';

const LABEL_KEY: Record<Capability, string> = {
  customer: 'roleSwitcher.customer',
  merchant: 'roleSwitcher.merchant',
  rider: 'roleSwitcher.rider',
  admin: 'roleSwitcher.admin',
};

/** สลับโหมดแบบ segmented pill ตาม Wingdai design system */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);
  const setActive = useAuthStore((s) => s.setActiveCapability);

  // มีบทบาทเดียวก็ไม่มีอะไรให้สลับ
  if (capabilities.length < 2) return null;

  return (
    <View
      testID="role-switcher"
      style={{
        flexDirection: 'row',
        gap: p.space.xs,
        padding: 5,
        borderRadius: p.radius.full,
        backgroundColor: tokens.bgRaised,
        ...p.shadow.card,
      }}
    >
      {capabilities.map((cap) => {
        const on = cap === active;
        return (
          <Pressable
            key={cap}
            testID={`role-btn-${cap}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => setActive(cap)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: p.radius.full,
              backgroundColor: on ? tokens.brandSolid : 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="small" color={on ? 'onBrand' : 'muted'} bold numberOfLines={1}>
              {t(LABEL_KEY[cap])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
