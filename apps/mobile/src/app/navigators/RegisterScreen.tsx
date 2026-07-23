import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import type { AuthStackParamList } from './AuthNavigator';

/** ค่าที่กรอกในหน้าสมัครสมาชิก ส่งต่อไปหน้า OtpVerify เป็น route param (task ถัดไปค่อยเรียก register จริง) */
export type RegisterFormValues = {
  username: string;
  email?: string;
  password: string;
  phone: string;
  fullName: string;
};

// เบอร์มือถือไทย: ขึ้นต้น 0 แล้วตามด้วย 6/8/9 แล้วอีก 8 หลัก รวม 10 หลัก
const PHONE_PATTERN = /^0[689]\d{8}$/;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!username.trim() || !password.trim() || !phone.trim() || !fullName.trim()) {
      setError('auth.register.required');
      return;
    }
    if (!PHONE_PATTERN.test(phone.trim())) {
      setError('auth.register.phoneInvalid');
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setError('auth.register.emailInvalid');
      return;
    }

    setError(null);
    const form: RegisterFormValues = {
      username: username.trim(),
      email: email.trim() ? email.trim() : undefined,
      password,
      phone: phone.trim(),
      fullName: fullName.trim(),
    };
    // ยังไม่เรียก register() ตรงนี้ — รอ OTP ยืนยันเบอร์ก่อน (task หน้าค่อยผูก authStore.register)
    navigation.navigate('OtpVerify', { form });
  }

  return (
    <View
      testID="screen-register"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h1">{t('auth.register.title')}</Text>

      <TextInput
        testID="input-username"
        accessibilityLabel={t('auth.register.username')}
        placeholder={t('auth.register.username')}
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        allowFontScaling={false}
        value={username}
        onChangeText={setUsername}
        style={{
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      <TextInput
        testID="input-email"
        accessibilityLabel={t('auth.register.email')}
        placeholder={t('auth.register.email')}
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        allowFontScaling={false}
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      <TextInput
        testID="input-password"
        accessibilityLabel={t('auth.register.password')}
        placeholder={t('auth.register.password')}
        placeholderTextColor={tokens.textMuted}
        secureTextEntry
        allowFontScaling={false}
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      <TextInput
        testID="input-phone"
        accessibilityLabel={t('auth.register.phone')}
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

      <TextInput
        testID="input-fullName"
        accessibilityLabel={t('auth.register.fullName')}
        placeholder={t('auth.register.fullName')}
        placeholderTextColor={tokens.textMuted}
        allowFontScaling={false}
        value={fullName}
        onChangeText={setFullName}
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
        <Text testID="register-error" variant="small" style={{ color: tokens.danger }}>
          {t(error)}
        </Text>
      ) : null}

      <Button testID="btn-register" label={t('auth.register.submit')} onPress={handleSubmit} />

      <Button
        testID="link-login"
        label={t('auth.register.toLogin')}
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}
