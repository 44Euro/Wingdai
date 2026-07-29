import React, { useRef, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
  route: RouteProp<AuthStackParamList, 'OtpVerify'>;
};

const OTP_LENGTH = 6;

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const verifyOtp = useAuthStore((s) => s.verifyOtp);

  const { form } = route.params;
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    const ok = await verifyOtp(code);
    if (!ok) {
      setError('auth.otp.invalid');
      return;
    }
    setError(null);
    navigation.navigate('ChooseAccountType', { form });
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
          onPress={() => {
            // mock: ยังไม่มี backend ส่ง OTP จริง — ปุ่มนี้กดได้แต่ไม่ทำอะไรตอนนี้
          }}
          style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}
        >
          <Text variant="small" color="link" bold>{t('auth.otp.resend')}</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg }}>
        <Button testID="btn-verify-otp" label={t('common.continue')} onPress={handleVerify} />
      </View>
    </SafeAreaView>
  );
}
