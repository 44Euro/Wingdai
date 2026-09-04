import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { OtpCodeEntry, OTP_LENGTH } from '../../features/auth/OtpCodeEntry';
import { requestOtp, verifyOtp } from '../../features/auth/otp';
import type { AuthStackParamList } from './AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
  route: RouteProp<AuthStackParamList, 'OtpVerify'>;
};

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { form, google } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleResend() {
    try {
      await requestOtp(form.phone);
      setCode('');
      setError(null);
    } catch {
      setError('auth.otp.resendFailed');
    }
  }

  async function handleVerify() {
    setChecking(true);
    try {
      // ตั๋วที่ได้ต้องส่งต่อไปถึงจอสมัคร ไม่งั้นเซิร์ฟเวอร์ปฏิเสธเพราะยังไม่ยืนยันเบอร์
      const verificationToken = await verifyOtp(form.phone, code);
      setError(null);
      navigation.navigate('ChooseAccountType', { form, verificationToken, google });
    } catch {
      // รหัสผิด หมดอายุ หรือกรอกผิดเกินกำหนด ผู้ใช้ทำอย่างเดียวกันคือกรอกใหม่หรือขอรหัสใหม่
      setError('auth.otp.invalid');
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView testID="screen-otp-verify" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('auth.otp.title')} onBack={() => navigation.goBack()} />

      <View style={{ flex: 1, paddingHorizontal: p.space.screen, gap: p.space.lg }}>
        <Text variant="body" color="muted">{t('auth.otp.description')}</Text>

        <OtpCodeEntry
          code={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          onResend={handleResend}
          error={error}
        />
      </View>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg }}>
        <Button
          testID="btn-verify-otp"
          label={t('common.continue')}
          disabled={checking || code.length < OTP_LENGTH}
          onPress={handleVerify}
        />
      </View>
    </SafeAreaView>
  );
}
