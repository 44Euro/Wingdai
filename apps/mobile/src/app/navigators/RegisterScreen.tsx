import React, { useState } from 'react';
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { ScreenHeader } from '../../ui/ScreenHeader';
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
  const { tokens, primitives: p } = useTheme();

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
    <SafeAreaView testID="screen-register" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title={t('auth.register.title')} onBack={() => navigation.goBack()} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.xl, gap: p.space.lg }}
        >
          <Field label={t('auth.register.fullName')}>
            <Input
              testID="input-fullName"
              accessibilityLabel={t('auth.register.fullName')}
              placeholder={t('auth.register.fullName')}
              value={fullName}
              onChangeText={setFullName}
            />
          </Field>

          <Field label={t('auth.register.username')}>
            <Input
              testID="input-username"
              accessibilityLabel={t('auth.register.username')}
              placeholder={t('auth.register.username')}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </Field>

          <Field label={t('auth.register.phone')}>
            <Input
              testID="input-phone"
              accessibilityLabel={t('auth.register.phone')}
              placeholder={t('auth.register.phone')}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </Field>

          <Field label={t('auth.register.email')}>
            <Input
              testID="input-email"
              accessibilityLabel={t('auth.register.email')}
              placeholder={t('auth.register.email')}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </Field>

          <Field label={t('auth.register.password')}>
            <Input
              testID="input-password"
              accessibilityLabel={t('auth.register.password')}
              placeholder={t('auth.register.password')}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </Field>

          {error ? (
            <Text testID="register-error" variant="small" color="danger" bold>
              {t(error)}
            </Text>
          ) : null}

          <Button testID="btn-register" label={t('auth.register.submit')} onPress={handleSubmit} />

          <Pressable
            testID="link-login"
            accessibilityRole="link"
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={({ pressed }) => ({ alignItems: 'center', paddingVertical: p.space.sm, opacity: pressed ? 0.7 : 1 })}
          >
            <Text variant="small" color="link" bold>{t('auth.register.toLogin')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
