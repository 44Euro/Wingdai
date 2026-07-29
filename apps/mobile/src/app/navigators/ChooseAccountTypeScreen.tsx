import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { ChoiceCard } from '../../ui/ChoiceCard';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';
import type { AccountType } from '../../data/types';

type Props = {
  route: RouteProp<AuthStackParamList, 'ChooseAccountType'>;
};

export function ChooseAccountTypeScreen({ route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const register = useAuthStore((s) => s.register);
  const error = useAuthStore((s) => s.error);
  const [choice, setChoice] = useState<AccountType | null>(null);

  const { form } = route.params;

  // A5 แยกสองจังหวะ: กดการ์ด = เลือก · กดปุ่มล่าง = ยืนยัน
  // เดิมกดการ์ดแล้วสมัครทันที เปลี่ยนใจไม่ได้เลย และปุ่มล่างที่ design วางไว้ก็หายไปด้วย
  async function handleContinue() {
    if (!choice) return;
    await register({ ...form, accountType: choice });
    // ไม่ต้อง navigate เอง — พอ authStore.register ตั้ง account สำเร็จ RootNavigator
    // จะ re-render แล้วสลับจาก AuthNavigator ไป stack ตาม capability อัตโนมัติ
  }

  return (
    <SafeAreaView
      testID="screen-choose-account-type"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ flex: 1, paddingHorizontal: p.space.screen, paddingTop: p.space.xl }}>
        <Text variant="h1">{t('auth.chooseType.title')}</Text>
        <Text variant="small" color="muted" style={{ marginTop: 9 }}>
          {t('auth.chooseType.subtitle')}
        </Text>

        <View style={{ gap: p.space.md, marginTop: p.space.xl }}>
          <ChoiceCard
            testID="choose-user"
            title={t('auth.chooseType.user')}
            description={t('auth.chooseType.userDescription')}
            icon="menu"
            tone="brand"
            selected={choice === 'user'}
            onPress={() => setChoice('user')}
          />

          <ChoiceCard
            testID="choose-rider"
            title={t('auth.chooseType.rider')}
            description={t('auth.chooseType.riderDescription')}
            icon="bike"
            tone="teal"
            selected={choice === 'rider'}
            onPress={() => setChoice('rider')}
          />
        </View>

        {error ? (
          <Text
            testID="choose-account-type-error"
            variant="small"
            color="danger"
            bold
            style={{ marginTop: p.space.md }}
          >
            {t(error)}
          </Text>
        ) : null}

        {/* A5 มีปุ่มยืนยันท้ายจอ — ดันลงล่างสุดให้เต็มจอ */}
        <View style={{ flex: 1, minHeight: p.space.lg }} />

        <Button
          testID="btn-choose-continue"
          label={t('common.continue')}
          disabled={!choice}
          onPress={handleContinue}
          style={{ marginBottom: p.space.lg }}
        />
      </View>
    </SafeAreaView>
  );
}
