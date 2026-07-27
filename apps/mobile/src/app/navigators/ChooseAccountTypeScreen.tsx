import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Icon, IconName } from '../../ui/Icon';
import { IconChip } from '../../ui/Surface';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';
import type { AccountType } from '../../data/types';

type Props = {
  route: RouteProp<AuthStackParamList, 'ChooseAccountType'>;
};

/** การ์ดตัวเลือกบทบาทตาม design (A5): ชิปไอคอน + ข้อความ + วงกลมติ๊กถูกด้านขวา */
function AccountTypeCard({
  testID,
  title,
  description,
  icon,
  tone,
  selected,
  onPress,
}: {
  testID: string;
  title: string;
  description: string;
  icon: IconName;
  tone: 'brand' | 'teal';
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
        <Text variant="bodyLg" bold>{title}</Text>
        <Text variant="caption" color="muted" style={{ marginTop: 3 }}>{description}</Text>
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
        {selected ? <Icon name="check" color="#FFFFFF" size={14} strokeWidth={3.4} /> : null}
      </View>
    </Pressable>
  );
}

export function ChooseAccountTypeScreen({ route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const register = useAuthStore((s) => s.register);
  const error = useAuthStore((s) => s.error);
  const [choice, setChoice] = useState<AccountType | null>(null);

  const { form } = route.params;

  // กดการ์ดแล้วสมัครเลย (พฤติกรรมเดิม) — state ใช้แค่ให้เห็นว่ากดอันไหนระหว่างรอ
  async function handleChoose(accountType: AccountType) {
    setChoice(accountType);
    await register({ ...form, accountType });
    // ไม่ต้อง navigate เอง — พอ authStore.register ตั้ง account สำเร็จ RootNavigator
    // จะ re-render แล้วสลับจาก AuthNavigator ไป stack ตาม capability อัตโนมัติ
  }

  return (
    <SafeAreaView
      testID="screen-choose-account-type"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ flex: 1, paddingHorizontal: p.space.screen, paddingTop: p.space.xl, gap: p.space.md }}>
        <Text variant="h1">{t('auth.chooseType.title')}</Text>

        <View style={{ gap: p.space.md, marginTop: p.space.md }}>
          <AccountTypeCard
            testID="choose-user"
            title={t('auth.chooseType.user')}
            description={t('auth.chooseType.userDescription')}
            icon="menu"
            tone="brand"
            selected={choice === 'user'}
            onPress={() => handleChoose('user')}
          />

          <AccountTypeCard
            testID="choose-rider"
            title={t('auth.chooseType.rider')}
            description={t('auth.chooseType.riderDescription')}
            icon="bike"
            tone="teal"
            selected={choice === 'rider'}
            onPress={() => handleChoose('rider')}
          />
        </View>

        {error ? (
          <Text testID="choose-account-type-error" variant="small" color="danger" bold>
            {t(error)}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
