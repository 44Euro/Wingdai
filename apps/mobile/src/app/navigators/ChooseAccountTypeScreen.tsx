import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';
import type { AccountType } from '../../data/types';

type Props = {
  route: RouteProp<AuthStackParamList, 'ChooseAccountType'>;
};

type CardProps = {
  testID: string;
  title: string;
  description: string;
  onPress: () => void;
};

function AccountTypeCard({ testID, title, description, onPress }: CardProps) {
  const { tokens, primitives } = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        borderRadius: primitives.radius.md,
        padding: primitives.space.lg,
        gap: primitives.space.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text variant="h3">{title}</Text>
      <Text variant="body" color="muted">
        {description}
      </Text>
    </Pressable>
  );
}

export function ChooseAccountTypeScreen({ route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const register = useAuthStore((s) => s.register);
  const error = useAuthStore((s) => s.error);

  const { form } = route.params;

  async function handleChoose(accountType: AccountType) {
    await register({ ...form, accountType });
    // ไม่ต้อง navigate เอง — พอ authStore.register ตั้ง account สำเร็จ RootNavigator
    // จะ re-render แล้วสลับจาก AuthNavigator ไป stack ตาม capability อัตโนมัติ
  }

  return (
    <View
      testID="screen-choose-account-type"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h1">{t('auth.chooseType.title')}</Text>

      <AccountTypeCard
        testID="choose-user"
        title={t('auth.chooseType.user')}
        description={t('auth.chooseType.userDescription')}
        onPress={() => handleChoose('user')}
      />

      <AccountTypeCard
        testID="choose-rider"
        title={t('auth.chooseType.rider')}
        description={t('auth.chooseType.riderDescription')}
        onPress={() => handleChoose('rider')}
      />

      {error ? (
        <Text testID="choose-account-type-error" variant="small" style={{ color: tokens.danger }}>
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}
