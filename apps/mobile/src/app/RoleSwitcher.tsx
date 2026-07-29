import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { ChoiceCard } from '../ui/ChoiceCard';
import type { IconName } from '../ui/Icon';
import { useAuthStore } from '../features/auth/authStore';
import type { Capability } from '../data/types';

const LABEL_KEY: Record<Capability, string> = {
  customer: 'roleSwitcher.customer',
  merchant: 'roleSwitcher.merchant',
  rider: 'roleSwitcher.rider',
  admin: 'roleSwitcher.admin',
};

const DESCRIPTION_KEY: Record<Capability, string> = {
  customer: 'roleSwitcher.customerDescription',
  merchant: 'roleSwitcher.merchantDescription',
  rider: 'roleSwitcher.riderDescription',
  admin: 'roleSwitcher.adminDescription',
};

const ICON: Record<Capability, IconName> = {
  customer: 'menu',
  merchant: 'store',
  rider: 'bike',
  admin: 'help',
};

const TONE: Record<Capability, 'brand' | 'teal' | 'neutral'> = {
  customer: 'brand',
  merchant: 'teal',
  rider: 'teal',
  admin: 'neutral',
};

/**
 * สลับโหมดด้วยการ์ดตัวเลือกหน้าตาเดียวกับ A5
 *
 * ลูกค้าธรรมดามีบทบาทเดียวจึงไม่ขึ้นเลย — จะเห็นก็ต่อเมื่อเป็นไรเดอร์
 * (สั่งอาหาร / รับงานส่ง) หรือเป็นลูกค้าที่มีร้านอนุมัติแล้ว (สั่งอาหาร / ร้านอาหาร)
 */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);
  const setActive = useAuthStore((s) => s.setActiveCapability);

  // มีบทบาทเดียวก็ไม่มีอะไรให้สลับ
  if (capabilities.length < 2) return null;

  return (
    <View testID="role-switcher" style={{ gap: p.space.md }}>
      <Text variant="kicker" color="muted">
        {t('roleSwitcher.title')}
      </Text>
      {capabilities.map((cap) => (
        <ChoiceCard
          key={cap}
          testID={`role-btn-${cap}`}
          title={t(LABEL_KEY[cap])}
          description={t(DESCRIPTION_KEY[cap])}
          icon={ICON[cap]}
          tone={TONE[cap]}
          selected={cap === active}
          onPress={() => setActive(cap)}
        />
      ))}
    </View>
  );
}
