import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { requestOtp, verifyOtp } from '../../features/auth/otp';
import type { AuthStackParamList } from './AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
  route: RouteProp<AuthStackParamList, 'OtpVerify'>;
};

const OTP_LENGTH = 6;
/** ต้องตรงกับ RESEND_COOLDOWN_MS ฝั่งเซิร์ฟเวอร์ (services/core-api/src/auth/otp.policy.ts) */
const RESEND_COOLDOWN_SECONDS = 60;

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { form, google } = route.params;
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  /** วินาทีที่เหลือก่อนขอรหัสใหม่ได้ — เซิร์ฟเวอร์บังคับ cooldown อยู่แล้ว อันนี้บอกผู้ใช้ให้รู้ตัว */
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    try {
      await requestOtp(form.phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
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
      // รหัสผิด หมดอายุ หรือกรอกผิดเกินกำหนด — ผู้ใช้ทำอย่างเดียวกันคือกรอกใหม่หรือขอรหัสใหม่
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

        {/* ช่องรหัส 6 ตัวตาม design — ช่องกรอกจริงเป็น TextInput ใสวางทับทั้งแถว
            ต้องกดที่ Pressable เพื่อสั่ง focus เอง ไม่พึ่งการกดโดน TextInput ใส ๆ ตรง ๆ
            เพราะ input ที่ opacity 0 รับสัมผัสไม่แน่นอน (บน Android แทบไม่ติดเลย) */}
        <Pressable
          testID="otp-boxes"
          accessibilityRole="button"
          accessibilityLabel={t('auth.otp.title')}
          onPress={() => inputRef.current?.focus()}
        >
          <View style={{ flexDirection: 'row', gap: p.space.sm }}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const char = code[i] ?? '';
              const isCursor = i === Math.min(code.length, OTP_LENGTH - 1);
              return (
                <View
                  key={i}
                  style={[
                    {
                      flex: 1,
                      height: 64,
                      borderRadius: p.radius.md,
                      backgroundColor: tokens.bgRaised,
                      borderWidth: 2,
                      borderColor: isCursor ? tokens.brandAccent : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    p.shadow.card,
                  ]}
                >
                  <Text variant="h2">{char}</Text>
                </View>
              );
            })}
          </View>

          <TextInput
            ref={inputRef}
            testID="input-otp-code"
            accessibilityLabel={t('auth.otp.title')}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
            caretHidden
            // iOS/Android เติมรหัสจาก SMS ให้อัตโนมัติได้ถ้าประกาศไว้
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            allowFontScaling={false}
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, OTP_LENGTH));
              setError(null);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 64,
              opacity: 0,
            }}
          />
        </Pressable>

        {error ? (
          <Text testID="otp-error" variant="small" color="danger" bold>
            {t(error)}
          </Text>
        ) : null}

        <Pressable
          testID="btn-resend"
          accessibilityRole="button"
          hitSlop={10}
          disabled={cooldown > 0}
          onPress={handleResend}
          style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}
        >
          {/* บอกเวลาที่เหลือ ไม่ใช่ปิดปุ่มเงียบ ๆ ให้ผู้ใช้กดซ้ำแล้วสงสัยว่าแอปเสีย */}
          <Text variant="small" color={cooldown > 0 ? 'faint' : 'link'} bold>
            {cooldown > 0 ? t('auth.otp.resendIn', { seconds: cooldown }) : t('auth.otp.resend')}
          </Text>
        </Pressable>
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
