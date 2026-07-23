import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import type { AuthStackParamList } from './AuthNavigator';

// เบอร์มือถือไทย: ขึ้นต้น 0 แล้วตามด้วย 6/8/9 แล้วอีก 8 หลัก รวม 10 หลัก
const PHONE_PATTERN = /^0[689]\d{8}$/;

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSendReset() {
    if (!phone.trim()) {
      setError('auth.register.phoneInvalid');
      setSent(false);
      return;
    }

    if (!PHONE_PATTERN.test(phone.trim())) {
      setError('auth.register.phoneInvalid');
      setSent(false);
      return;
    }

    // Mock: ยังไม่เรียก reset จริง — เพียงแสดงข้อความสำเร็จ (Phase 1)
    setError(null);
    setSent(true);
  }

  return (
    <View
      testID="screen-forgot-password"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h1">{t('auth.forgot.title')}</Text>
      <Text variant="body" color="muted">
        {t('auth.forgot.description')}
      </Text>

      <TextInput
        testID="input-phone"
        accessibilityLabel={t('auth.forgot.title')}
        placeholder={t('auth.register.phone')}
        placeholderTextColor={tokens.textMuted}
        keyboardType="phone-pad"
        allowFontScaling={false}
        value={phone}
        onChangeText={setPhone}
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
        <Text testID="forgot-error" variant="small" style={{ color: tokens.danger }}>
          {t(error)}
        </Text>
      ) : null}

      {sent ? (
        <Text testID="forgot-sent" variant="small" style={{ color: tokens.success }}>
          {t('auth.forgot.sent')}
        </Text>
      ) : null}

      <Button
        testID="btn-send-reset"
        label={t('auth.forgot.submit')}
        onPress={handleSendReset}
      />

      <Button
        testID="link-back-login"
        label={t('common.back')}
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}
