import React, { useState } from 'react';
import {
  View,
  TextInput,
  Image,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Input, Field } from '../../ui/Field';
import { GoogleGIcon } from '../../ui/GoogleGIcon';
import {
  signInWithGoogle, GoogleCancelled, GOOGLE_SIGN_IN_AVAILABLE,
} from '../../features/auth/google';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';

const LOGO_MARK = require('../../../assets/logo-mark.png');

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

/** ปุ่ม "เข้าสู่ระบบด้วย Google" — ทรงเดียวกับ ghost button ของ design + โลโก้ G ทางการ */
function GoogleButton({
  label, onPress, testID, disabled,
}: { label: string; onPress: () => void; testID?: string; disabled?: boolean }) {
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 56,
          borderRadius: p.radius.pill,
          backgroundColor: tokens.bgRaised,
          borderWidth: 1.6,
          borderColor: tokens.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: p.space.md,
          paddingHorizontal: p.space.xl,
          transform: [{ scale: pressed ? 0.975 : 1 }],
          // จางลงตอนกำลังคุยกับ Google เพื่อให้เห็นว่ากดติดแล้ว กำลังรออยู่
          opacity: disabled ? 0.5 : 1,
        },
        p.shadow.card,
      ]}
    >
      <GoogleGIcon size={20} />
      <Text variant="body" color="primary" bold>
        {label}
      </Text>
    </Pressable>
  );
}

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const login = useAuthStore((s) => s.login);
  const signInWithGoogleAccount = useAuthStore((s) => s.signInWithGoogle);
  const error = useAuthStore((s) => s.error);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function handleGoogle() {
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      const idToken = await signInWithGoogle();
      const result = await signInWithGoogleAccount(idToken);
      /**
       * คนใหม่ยังเข้าแอปไม่ได้ทันที — Google ไม่ทดแทน OTP (claude.md §4.2)
       * ยังต้องมี username กับเบอร์ที่ยืนยันแล้ว เพราะไรเดอร์และร้านต้องโทรหาลูกค้าได้จริง
       * ส่วนคนที่ผูกบัญชีไว้แล้ว RootNavigator จะสลับ stack ให้เองเมื่อ account ถูกตั้ง
       */
      if (result.needsRegistration) {
        navigation.navigate('Register', {
          google: { googleToken: result.googleToken, prefill: result.prefill },
        });
      }
    } catch (e) {
      // กดยกเลิกเองไม่ใช่ข้อผิดพลาด — ไม่ต้องขึ้นข้อความอะไรให้รำคาญ
      if (!(e instanceof GoogleCancelled)) setGoogleError('auth.login.googleFailed');
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <SafeAreaView
      testID="screen-login"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            // จอสูงกว่าเนื้อหาเสมอ — กระจายที่ว่างเป็นสองช่อง (ใต้หัวจอ กับเหนือบรรทัดท้าย)
            // แทนที่จะกองไว้ก้อนเดียวใต้ปุ่ม Google ซึ่งดูเหมือนจอค้างมากกว่าจงใจเว้น
            justifyContent: 'space-between',
            paddingHorizontal: p.space.xl,
            paddingTop: p.space.xl,
            paddingBottom: p.space.lg,
            gap: p.space.xl,
          }}
        >
          {/* A2 — โลโก้เล็กชิดซ้าย ไม่ใช่ hero กลางจอ */}
          <View style={{ gap: p.space.lg }}>
            <Image
              source={LOGO_MARK}
              accessibilityLabel={t('common.appName')}
              resizeMode="contain"
              style={{ width: 52, height: 52 }}
            />
            <View style={{ gap: p.space.xs }}>
              <Text variant="h1">{t('auth.login.welcome')}</Text>
              <Text variant="small" color="muted">
                {t('auth.login.subtitle')}
              </Text>
            </View>
          </View>

          <View style={{ gap: p.space.md }}>
            <Field label={t('auth.login.identifier')}>
              <Input
                testID="input-identifier"
                accessibilityLabel={t('auth.login.identifier')}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                value={identifier}
                onChangeText={setIdentifier}
              />
            </Field>

            {/* ช่องรหัสผ่าน + ปุ่มตาสลับแสดง/ซ่อน — ประกอบเองเพราะปุ่มต้องอยู่ในกรอบเดียวกัน */}
            <Field label={t('auth.login.password')}>
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
                  accessibilityLabel={t('auth.login.password')}
                  placeholderTextColor={tokens.textFaint}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
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
                    strokeWidth={1.8}
                  />
                </Pressable>
              </View>
            </Field>

            {/* A2 วาง "ลืมรหัสผ่าน" ชิดขวาลำพัง — สมัครสมาชิกย้ายลงท้ายจอ */}
            <Pressable
              testID="link-forgot"
              accessibilityRole="link"
              onPress={() => navigation.navigate('ForgotPassword')}
              hitSlop={10}
              style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}
            >
              <Text variant="small" color="link" bold>
                {t('auth.login.forgot')}
              </Text>
            </Pressable>

            {error ? (
              <Text testID="login-error" variant="small" color="danger" bold>
                {t(error)}
              </Text>
            ) : null}

            <Button
              testID="btn-login"
              label={t('auth.login.submit')}
              onPress={() => login(identifier, password)}
            />

            {/*
              บนเว็บไม่มีโมดูลเนทีฟของ Google — ซ่อนทั้งเส้นคั่นและปุ่ม ไม่ใช่โชว์ปุ่มที่กดแล้ว error
              (claude.md §10 "ห้ามปล่อย UI ที่กดแล้วไม่เกิดอะไร")
            */}
            {GOOGLE_SIGN_IN_AVAILABLE ? (
              <>
                {/* เส้นคั่น "หรือ" */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md, marginVertical: p.space.xs }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: tokens.borderSubtle }} />
                  <Text variant="caption" color="muted">
                    {t('auth.login.or')}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: tokens.borderSubtle }} />
                </View>

                <GoogleButton
                  testID="btn-google"
                  label={t('auth.login.google')}
                  disabled={googleBusy}
                  onPress={handleGoogle}
                />

                {googleError ? (
                  <Text
                    testID="google-error"
                    variant="caption"
                    color="danger"
                    bold
                    style={{ textAlign: 'center' }}
                  >
                    {t(googleError)}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>

          {/* A2 — บรรทัดท้ายจอกลางจอ: ยังไม่มีบัญชี? สมัครสมาชิก */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: p.space.xs,
            }}
          >
            <Text variant="small" color="muted">
              {t('auth.login.newHere')}
            </Text>
            <Pressable
              testID="link-register"
              accessibilityRole="link"
              onPress={() => navigation.navigate('Register')}
              hitSlop={10}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text variant="small" color="link" bold>
                {t('auth.register.title')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PendingApprovalScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView
      testID="screen-pending"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44, gap: p.space.md }}>
        <View
          style={[
            {
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: tokens.bgRaised,
              alignItems: 'center',
              justifyContent: 'center',
            },
            p.shadow.raised,
          ]}
        >
          <Icon name="clock" color={tokens.brandAccent} size={50} strokeWidth={1.8} />
        </View>
        <Text variant="h2" style={{ marginTop: p.space.sm, textAlign: 'center' }}>
          {t('auth.pending.title')}
        </Text>
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
          {t('auth.pending.description')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg }}>
        <Button
          testID="btn-logout"
          label={t('auth.pending.logout')}
          variant="secondary"
          onPress={() => logout()}
        />
      </View>
    </SafeAreaView>
  );
}
