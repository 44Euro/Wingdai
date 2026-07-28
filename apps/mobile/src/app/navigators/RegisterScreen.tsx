import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Checkbox } from '../../ui/Surface';
import { Field, Input } from '../../ui/Field';
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

/**
 * design โชว์ชิป +66 หน้าช่องเบอร์ คนกรอกจึงพิมพ์ได้ทั้ง "081 234 5678" และ "81 234 5678"
 * ตัดอักขระที่ไม่ใช่ตัวเลขทิ้ง แล้วเติม 0 ให้ถ้าไม่มี — เก็บลงฟอร์มเป็น 0XXXXXXXXX เสมอ
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  return digits.startsWith('0') ? digits : `0${digits}`;
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!username.trim() || !password.trim() || !phone.trim() || !fullName.trim()) {
      setError('auth.register.required');
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      setError('auth.register.phoneInvalid');
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setError('auth.register.emailInvalid');
      return;
    }
    // PDPA: ต้องกดยอมรับเอง ห้ามติ๊กไว้ให้ล่วงหน้า
    if (!acceptedTerms) {
      setError('auth.register.termsRequired');
      return;
    }

    setError(null);
    const form: RegisterFormValues = {
      username: username.trim(),
      email: email.trim() ? email.trim() : undefined,
      password,
      phone: normalizedPhone,
      fullName: fullName.trim(),
    };
    // ยังไม่เรียก register() ตรงนี้ — รอ OTP ยืนยันเบอร์ก่อน (task หน้าค่อยผูก authStore.register)
    navigation.navigate('OtpVerify', { form });
  }

  return (
    <SafeAreaView testID="screen-register" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: p.space.xl,
            paddingTop: p.space.sm,
            paddingBottom: p.space.lg,
          }}
        >
          {/* A3 ใช้ลิงก์ "< ย้อนกลับ" ตัวหนังสือ ไม่ใช่ปุ่มกลมแบบ ScreenHeader ของจอในแอป */}
          <Pressable
            testID="btn-back"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.xs, minHeight: 44 }}
          >
            <Icon name="chevronLeft" color={tokens.textMuted} size={20} strokeWidth={2.4} />
            <Text variant="small" color="muted" bold>
              {t('common.back')}
            </Text>
          </Pressable>

          <View style={{ gap: p.space.xs, marginTop: p.space.md, marginBottom: p.space.xl }}>
            <Text variant="h1">{t('auth.register.title')}</Text>
            <Text variant="small" color="muted">
              {t('auth.register.subtitle')}
            </Text>
          </View>

          <View style={{ gap: p.space.md }}>
            <Field label={t('auth.register.fullName')}>
              <Input
                testID="input-fullName"
                accessibilityLabel={t('auth.register.fullName')}
                value={fullName}
                onChangeText={setFullName}
              />
            </Field>

            {/* A3 ไม่มีช่องนี้ แต่ claude.md §4.2 กำหนดให้สมัครต้องมี username และ login ใช้ username */}
            <Field label={t('auth.register.username')}>
              <Input
                testID="input-username"
                accessibilityLabel={t('auth.register.username')}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            </Field>

            <Field label={t('auth.register.phone')}>
              <View style={{ flexDirection: 'row', gap: p.space.sm }}>
                <View
                  style={[
                    {
                      justifyContent: 'center',
                      paddingHorizontal: p.space.lg,
                      backgroundColor: tokens.bgRaised,
                      borderRadius: p.radius.md,
                    },
                    p.shadow.card,
                  ]}
                >
                  {/* ธงเป็นอีโมจิตาม design — ถ้าเครื่องไหนไม่มี glyph ธงจะกลายเป็นตัวอักษร "TH" ซึ่งยังอ่านรู้เรื่อง */}
                  <Text variant="body" bold>
                    🇹🇭 +66
                  </Text>
                </View>
                <Input
                  testID="input-phone"
                  accessibilityLabel={t('auth.register.phone')}
                  keyboardType="phone-pad"
                  placeholder={t('auth.register.phonePlaceholder')}
                  containerStyle={{ flex: 1 }}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </Field>

            <Field label={t('auth.register.email')} hint={t('auth.register.optional')}>
              <Input
                testID="input-email"
                accessibilityLabel={t('auth.register.email')}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
              />
            </Field>

            {/* ช่องรหัสผ่าน + ปุ่มตาสลับแสดง/ซ่อน — ประกอบเองเพราะปุ่มต้องอยู่ในกรอบเดียวกัน */}
            <Field label={t('auth.register.password')}>
              <View
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: tokens.bgRaised,
                    borderWidth: 1.6,
                    borderColor: pwFocused ? tokens.brandAccent : 'transparent',
                    borderRadius: p.radius.md,
                    paddingRight: p.space.lg,
                  },
                  p.shadow.card,
                ]}
              >
                <TextInput
                  testID="input-password"
                  accessibilityLabel={t('auth.register.password')}
                  placeholderTextColor={tokens.textFaint}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  allowFontScaling={false}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  style={{
                    flex: 1,
                    paddingHorizontal: p.space.lg,
                    paddingVertical: 14,
                    minHeight: 52,
                    color: tokens.textPrimary,
                    fontFamily: p.fontFamily.bodyBold,
                    fontSize: p.fontSize.body,
                  }}
                />
                <Pressable
                  testID="toggle-password"
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                >
                  <Icon
                    name={showPassword ? 'eyeOff' : 'eye'}
                    color={tokens.textFaint}
                    size={20}
                    strokeWidth={2.2}
                  />
                </Pressable>
              </View>
            </Field>
          </View>

          <Checkbox
            testID="checkbox-terms"
            checked={acceptedTerms}
            onChange={setAcceptedTerms}
            label={t('auth.register.terms')}
          />

          {error ? (
            <Text testID="register-error" variant="small" color="danger" bold style={{ marginTop: p.space.sm }}>
              {t(error)}
            </Text>
          ) : null}

          {/* A3 ดันปุ่มลงท้ายจอ */}
          <View style={{ flex: 1, minHeight: p.space.lg }} />

          <Button testID="btn-register" label={t('auth.register.submit')} onPress={handleSubmit} />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: p.space.xs,
              marginTop: p.space.md,
            }}
          >
            <Text variant="small" color="muted">
              {t('auth.register.haveAccount')}
            </Text>
            <Pressable
              testID="link-login"
              accessibilityRole="link"
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text variant="small" color="link" bold>
                {t('auth.login.title')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
