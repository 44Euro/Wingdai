import React, { useState } from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Card } from '../ui/Surface';
import { ChoiceCard } from '../ui/ChoiceCard';
import type { IconName } from '../ui/Icon';
import { useAuthStore } from '../features/auth/authStore';
import type { Capability } from '../data/types';

const LABEL_KEY: Record<Capability, string> = {
  customer: 'roleSwitcher.customer',
  merchant: 'roleSwitcher.merchant',
  rider: 'roleSwitcher.rider',
  admin: 'roleSwitcher.admin',
  superAdmin: 'roleSwitcher.superAdmin',
};

const DESCRIPTION_KEY: Record<Capability, string> = {
  customer: 'roleSwitcher.customerDescription',
  merchant: 'roleSwitcher.merchantDescription',
  rider: 'roleSwitcher.riderDescription',
  admin: 'roleSwitcher.adminDescription',
  superAdmin: 'roleSwitcher.superAdminDescription',
};

const ICON: Record<Capability, IconName> = {
  customer: 'menu',
  merchant: 'store',
  rider: 'bike',
  admin: 'help',
  superAdmin: 'store',
};

const TONE: Record<Capability, 'brand' | 'teal' | 'neutral'> = {
  customer: 'brand',
  merchant: 'teal',
  rider: 'teal',
  admin: 'neutral',
  superAdmin: 'teal',
};

/** สลับโหมดด้วยการ์ดตัวเลือกหน้าตาเดียวกับ A5 */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);
  const setActive = useAuthStore((s) => s.setActiveCapability);

  /** โหมดที่กดไว้แต่ยังไม่ยืนยัน */
  const [pending, setPending] = useState<Capability | null>(null);

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
          testID={`role-card-${cap}`}
          title={t(LABEL_KEY[cap])}
          description={t(DESCRIPTION_KEY[cap])}
          icon={ICON[cap]}
          tone={TONE[cap]}
          selected={cap === active}
          onPress={() => {
            if (cap === active) return;
            setPending(cap);
          }}
        />
      ))}

      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(27,25,23,0.55)',
            justifyContent: 'center',
            padding: p.space.xl,
          }}
        >
          <Card style={{ gap: p.space.md, padding: p.space.xl }}>
            <Text variant="h3">{t('roleSwitcher.confirmTitle')}</Text>
            {/* บอกชื่อโหมดปลายทาง ไม่ใช่ถาม "แน่ใจไหม" ลอย ๆ ที่ตอบไม่ได้ว่ากำลังจะไปไหน */}
            <Text variant="body" color="muted">
              {t('roleSwitcher.confirmBody', {
                role: pending ? t(LABEL_KEY[pending]) : '',
              })}
            </Text>
            <Button
              testID="confirm-switch-role"
              label={t('roleSwitcher.confirmSwitch')}
              onPress={() => {
                if (pending) setActive(pending);
                setPending(null);
              }}
            />
            <Button
              testID="cancel-switch-role"
              variant="secondary"
              label={t('common.cancel')}
              onPress={() => setPending(null)}
            />
          </Card>
        </View>
      </Modal>
    </View>
  );
}
