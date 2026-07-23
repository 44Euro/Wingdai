import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
  route: RouteProp<AuthStackParamList, 'OtpVerify'>;
};

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const verifyOtp = useAuthStore((s) => s.verifyOtp);

  const { form } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    const ok = await verifyOtp(code);
    if (!ok) {
      setError('auth.otp.invalid');
      return;
    }
    setError(null);
    navigation.navigate('ChooseAccountType', { form });
  }

  return (
    <View
      testID="screen-otp-verify"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h1">{t('auth.otp.title')}</Text>
      <Text variant="body" color="muted">
        {t('auth.otp.description')}
      </Text>

      <TextInput
        testID="input-otp-code"
        accessibilityLabel={t('auth.otp.title')}
        placeholder="000000"
        placeholderTextColor={tokens.textMuted}
        keyboardType="numeric"
        maxLength={6}
        allowFontScaling={false}
        value={code}
        onChangeText={setCode}
        style={{
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      {error ? (
        <Text testID="otp-error" variant="small" style={{ color: tokens.danger }}>
          {t(error)}
        </Text>
      ) : null}

      <Button testID="btn-verify-otp" label={t('common.continue')} onPress={handleVerify} />

      <Button
        testID="btn-resend"
        label={t('auth.otp.resend')}
        variant="secondary"
        onPress={() => {
          // mock: ยังไม่มี backend ส่ง OTP จริง — ปุ่มนี้กดได้แต่ไม่ทำอะไรตอนนี้
        }}
      />
    </View>
  );
}
