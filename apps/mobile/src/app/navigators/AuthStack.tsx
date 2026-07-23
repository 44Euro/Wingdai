import React, { useState } from 'react';
import {
  View,
  TextInput,
  Image,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { GoogleGIcon } from '../../ui/GoogleGIcon';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';

const LOGO_MARK = require('../../../assets/logo-mark.png');

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

/**
 * ปุ่มหลัก (เข้าสู่ระบบ) — ไล่เฉด brand-700 → brand-800 เพื่อให้ดูมีมิติกว่าปุ่มพื้นเรียบ
 * ทั้งสองเฉดเข้มพอให้ตัวหนังสือขาวผ่าน AA (4.83:1 และ 6.79:1) ตลอดทั้งปุ่ม
 */
function PrimaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { primitives: p } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: p.radius.md,
        opacity: pressed ? 0.92 : 1,
        // เงาโทนแบรนด์ให้ปุ่มลอยจากพื้น
        shadowColor: p.brand[700],
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      })}
    >
      <LinearGradient
        colors={[p.brand[700], p.brand[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 52,
          borderRadius: p.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: p.space.xl,
        }}
      >
        <Text variant="body" color="onBrand" style={{ fontFamily: p.fontFamily.bodyBold }}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

/** ปุ่ม "เข้าสู่ระบบด้วย Google" — ทรง/ขนาดเดียวกับปุ่มหลัก แต่พื้นยกระดับ + โลโก้ G ทางการ */
function GoogleButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: p.radius.md,
        backgroundColor: tokens.bgRaised,
        borderWidth: 1.5,
        borderColor: tokens.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: p.space.md,
        paddingHorizontal: p.space.xl,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <GoogleGIcon size={20} />
      <Text variant="body" color="primary" style={{ fontFamily: p.fontFamily.bodyBold }}>
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
  const [focused, setFocused] = useState<'id' | 'pw' | null>(null);
  const [googleNote, setGoogleNote] = useState(false);

  // กล่อง input แบบมีพื้น (bgRaised) + ขอบเปลี่ยนสีตอนโฟกัส — ความกว้างขอบคงที่ 1.5 กันเลย์เอาต์ขยับ
  const boxStyle = (isFocused: boolean): TextStyle => ({
    borderWidth: 1.5,
    borderColor: isFocused ? tokens.brandSolid : tokens.borderSubtle,
    borderRadius: p.radius.md,
    backgroundColor: tokens.bgRaised,
    color: tokens.textPrimary,
    fontFamily: p.fontFamily.body,
    fontSize: p.fontSize.body,
    minHeight: 52,
  });

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
            padding: p.space.xl,
            gap: p.space.xl,
          }}
        >
          {/* ── Hero: โลโก้ + เฉดแสงอุ่น + ชื่อแบรนด์ + สโลแกน ── */}
          <View style={{ alignItems: 'center', gap: p.space.sm }}>
            <View style={{ width: 176, height: 176, alignItems: 'center', justifyContent: 'center' }}>
              <LinearGradient
                colors={[p.brand[400], p.brand[600]]}
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
            <TextInput
              testID="input-identifier"
              accessibilityLabel={t('auth.login.identifier')}
              placeholder={t('auth.login.identifier')}
              placeholderTextColor={tokens.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              allowFontScaling={false}
              value={identifier}
              onChangeText={setIdentifier}
              onFocus={() => setFocused('id')}
              onBlur={() => setFocused(null)}
              style={[boxStyle(focused === 'id'), { paddingHorizontal: p.space.lg, paddingVertical: p.space.md }]}
            />

            {/* ช่องรหัสผ่าน + ปุ่มแสดง/ซ่อน */}
            <View
              style={[
                boxStyle(focused === 'pw'),
                { flexDirection: 'row', alignItems: 'center', paddingRight: p.space.lg },
              ]}
            >
              <TextInput
                testID="input-password"
                accessibilityLabel={t('auth.login.password')}
                placeholder={t('auth.login.password')}
                placeholderTextColor={tokens.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                allowFontScaling={false}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
                style={{
                  flex: 1,
                  paddingHorizontal: p.space.lg,
                  paddingVertical: p.space.md,
                  color: tokens.textPrimary,
                  fontFamily: p.fontFamily.body,
                  fontSize: p.fontSize.body,
                  minHeight: 52,
                }}
              />
              <Pressable
                testID="toggle-password"
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
              >
                <Text variant="small" style={{ color: tokens.brandLink, fontFamily: p.fontFamily.bodyBold }}>
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
                <Text variant="small" style={{ color: tokens.brandLink, fontFamily: p.fontFamily.bodyBold }}>
                  {t('auth.register.title')}
                </Text>
              </Pressable>
              <Pressable
                testID="link-forgot"
                accessibilityRole="link"
                onPress={() => navigation.navigate('ForgotPassword')}
                hitSlop={10}
              >
                <Text variant="small" style={{ color: tokens.brandLink }}>
                  {t('auth.login.forgot')}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <Text testID="login-error" variant="small" style={{ color: tokens.danger }}>
                {t(error)}
              </Text>
            ) : null}

            <PrimaryButton
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
  const { tokens, primitives } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View
      testID="screen-pending"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h2">{t('auth.pending.title')}</Text>
      <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
        {t('auth.pending.description')}
      </Text>
      <Button
        testID="btn-logout"
        label={t('auth.pending.logout')}
        variant="secondary"
        onPress={() => logout()}
      />
    </View>
  );
}
