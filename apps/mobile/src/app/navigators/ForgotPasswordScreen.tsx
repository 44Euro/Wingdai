import React, { useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { OtpCodeEntry, OTP_LENGTH } from '../../features/auth/OtpCodeEntry';
import { repos } from '../../data';
import type { AuthStackParamList } from './AuthNavigator';

// เบอร์มือถือไทย: ขึ้นต้น 0 แล้วตามด้วย 6/8/9 แล้วอีก 8 หลัก รวม 10 หลัก
const PHONE_PATTERN = /^0[689]\d{8}$/;
/** ต้องตรงกับ PASSWORD_MIN_LENGTH ฝั่งเซิร์ฟเวอร์ (services/core-api/src/auth/password.ts) */
const PASSWORD_MIN_LENGTH = 8;

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

type Step = 'phone' | 'code' | 'password' | 'done';

/**
 * ลืมรหัสผ่าน สามขั้นบนจอเดียว (product-spec §4.2)
 *
 * ใช้ท่อ OTP ชุดเดิมทั้งหมด ต่างจากตอนสมัครแค่ `purpose` ที่ขอไป ตั๋วที่ได้จึงผูกกับงานนี้
 * และเอาไปสมัครสมาชิกไม่ได้ ทุกขั้นตอบเหมือนกันไม่ว่าเบอร์นั้นจะมีบัญชีหรือไม่ — ปลายทางนี้
 * ไม่ต้องล็อกอินและยกบัญชีให้ ถ้าตอบต่างกันมันก็กลายเป็นเครื่องไล่เดาว่าเบอร์ไหนสมัครไว้แล้ว
 */
export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendCode() {
    const trimmed = phone.trim();
    if (!PHONE_PATTERN.test(trimmed)) {
      setError('auth.register.phoneInvalid');
      return;
    }

    setBusy(true);
    try {
      await repos.auth.requestOtp(trimmed, 'password_reset');
      setPhone(trimmed);
      setError(null);
      setStep('code');
    } catch {
      setError('auth.forgot.failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    try {
      await repos.auth.requestOtp(phone, 'password_reset');
      setCode('');
      setError(null);
    } catch {
      setError('auth.otp.resendFailed');
    }
  }

  async function handleVerify() {
    setBusy(true);
    try {
      setTicket(await repos.auth.verifyOtp(phone, code));
      setError(null);
      setStep('password');
    } catch {
      setError('auth.otp.invalid');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (password !== confirm) {
      setError('auth.forgot.mismatch');
      return;
    }

    setBusy(true);
    try {
      await repos.auth.resetPassword({ phone, verificationToken: ticket, newPassword: password });
      setError(null);
      setStep('done');
    } catch {
      setError('auth.forgot.failed');
    } finally {
      setBusy(false);
    }
  }

  const TITLE: Record<Step, string> = {
    phone: 'auth.forgot.title',
    code: 'auth.forgot.codeTitle',
    password: 'auth.forgot.newPasswordTitle',
    done: 'auth.forgot.newPasswordTitle',
  };

  return (
    <SafeAreaView
      testID="screen-forgot-password"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader
        title={t(TITLE[step])}
        onBack={() => (step === 'phone' ? navigation.goBack() : setStep('phone'))}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: p.space.screen, gap: p.space.lg, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'phone' ? (
          <>
            <Text variant="body" color="muted">{t('auth.forgot.description')}</Text>
            <Field label={t('auth.register.phone')}>
              <Input
                testID="input-phone"
                accessibilityLabel={t('auth.register.phone')}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setError(null);
                }}
              />
            </Field>
          </>
        ) : null}

        {step === 'code' ? (
          <>
            <Text variant="body" color="muted">
              {t('auth.forgot.codeDescription', { phone })}
            </Text>
            <OtpCodeEntry
              testIDPrefix="forgot-otp"
              code={code}
              onChange={(v) => {
                setCode(v);
                setError(null);
              }}
              onResend={handleResend}
              error={null}
            />
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <Text variant="body" color="muted">{t('auth.forgot.newPasswordDescription')}</Text>
            <Field label={t('auth.forgot.newPassword')}>
              <Input
                testID="input-new-password"
                accessibilityLabel={t('auth.forgot.newPassword')}
                secureTextEntry
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
              />
            </Field>
            <Field label={t('auth.forgot.confirmPassword')}>
              <Input
                testID="input-confirm-password"
                accessibilityLabel={t('auth.forgot.confirmPassword')}
                secureTextEntry
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  setError(null);
                }}
              />
            </Field>
          </>
        ) : null}

        {step === 'done' ? (
          <Text testID="forgot-done" variant="body" color="success" bold>
            {t('auth.forgot.done')}
          </Text>
        ) : null}

        {error ? (
          <Text testID="forgot-error" variant="small" color="danger" bold>
            {t(error)}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, gap: p.space.sm }}>
        {step === 'phone' ? (
          <Button
            testID="btn-send-reset"
            label={t('auth.forgot.submit')}
            disabled={busy}
            onPress={handleSendCode}
          />
        ) : null}

        {step === 'code' ? (
          <Button
            testID="btn-verify-reset"
            label={t('common.continue')}
            disabled={busy || code.length < OTP_LENGTH}
            onPress={handleVerify}
          />
        ) : null}

        {step === 'password' ? (
          <Button
            testID="btn-save-password"
            label={t('auth.forgot.save')}
            disabled={busy || password.length < PASSWORD_MIN_LENGTH}
            onPress={handleSave}
          />
        ) : null}

        {step === 'done' ? (
          <Button
            testID="btn-back-to-login"
            label={t('auth.login.submit')}
            onPress={() => navigation.goBack()}
          />
        ) : null}

        <Pressable
          testID="link-back-login"
          accessibilityRole="link"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => ({ alignItems: 'center', paddingVertical: p.space.sm, opacity: pressed ? 0.7 : 1 })}
        >
          <Text variant="small" color="link" bold>{t('common.back')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
