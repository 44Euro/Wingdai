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
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Input } from '../../ui/Field';
import { GoogleGIcon } from '../../ui/GoogleGIcon';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';

const LOGO_MARK = require('../../../assets/logo-mark.png');

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

/** ปุ่ม "เข้าสู่ระบบด้วย Google" — ทรงเดียวกับ ghost button ของ design + โลโก้ G ทางการ */
function GoogleButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
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
  const { tokens, primitives: p, scheme } = useTheme();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [googleNote, setGoogleNote] = useState(false);

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
            justifyContent: 'center',
            paddingHorizontal: p.space.xl,
            paddingVertical: p.space.xl,
            gap: p.space.xl,
          }}
        >
          {/* ── Hero: โลโก้ + เฉดแสงอุ่น + ชื่อแบรนด์ + สโลแกน ── */}
          <View style={{ alignItems: 'center', gap: p.space.sm }}>
            <View style={{ width: 176, height: 176, alignItems: 'center', justifyContent: 'center' }}>
              <LinearGradient
                colors={[p.brand[400], p.brand[500]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 88,
                  opacity: scheme === 'dark' ? 0.28 : 0.16,
                }}
              />
              <Image
                source={LOGO_MARK}
                accessibilityLabel={t('common.appName')}
                resizeMode="contain"
                style={{ width: 104, height: 104 }}
              />
            </View>
            <Text variant="display">{t('common.appName')}</Text>
            <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
              {t('auth.login.tagline')}
            </Text>
          </View>

          {/* ── ฟอร์มเข้าสู่ระบบ ── */}
          <View style={{ gap: p.space.md }}>
            <Input
              testID="input-identifier"
              accessibilityLabel={t('auth.login.identifier')}
              placeholder={t('auth.login.identifier')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              value={identifier}
              onChangeText={setIdentifier}
            />

            {/* ช่องรหัสผ่าน + ปุ่มแสดง/ซ่อน — ประกอบเองเพราะต้องมีปุ่มอยู่ในกรอบเดียวกัน */}
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
                placeholder={t('auth.login.password')}
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
                hitSlop={10}
              >
                <Text variant="small" color="link" bold>
                  {showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                </Text>
              </Pressable>
            </View>

            {/* ลิงก์ตัวอักษรเล็กใต้ช่องรหัสผ่าน: สมัครสมาชิก (ซ้าย) · ลืมรหัสผ่าน (ขวา) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable
                testID="link-register"
                accessibilityRole="link"
                onPress={() => navigation.navigate('Register')}
                hitSlop={10}
              >
                <Text variant="small" color="link" bold>
                  {t('auth.register.title')}
                </Text>
              </Pressable>
              <Pressable
                testID="link-forgot"
                accessibilityRole="link"
                onPress={() => navigation.navigate('ForgotPassword')}
                hitSlop={10}
              >
                <Text variant="small" color="link">
                  {t('auth.login.forgot')}
                </Text>
              </Pressable>
            </View>

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
              onPress={() => setGoogleNote(true)}
            />

            {googleNote ? (
              <Text
                testID="google-note"
                variant="caption"
                color="muted"
                style={{ textAlign: 'center' }}
              >
                {t('auth.login.googleSoon')}
              </Text>
            ) : null}
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
