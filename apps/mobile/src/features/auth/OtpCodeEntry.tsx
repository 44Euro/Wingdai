import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';

export const OTP_LENGTH = 6;
/** ต้องตรงกับ RESEND_COOLDOWN_MS ฝั่งเซิร์ฟเวอร์ (services/core-api/src/auth/otp.policy.ts) */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * ช่องกรอกรหัส 6 หลักพร้อมปุ่มขอรหัสใหม่ ใช้ร่วมกันทั้งจอสมัครสมาชิกและจอลืมรหัสผ่าน
 *
 * แยกออกมาเพราะสองเส้นทางนั้นกรอกรหัสเหมือนกันทุกอย่าง ต่างกันแค่ปลายทางหลังกรอกถูก
 * ถ้าปล่อยให้แต่ละจอมีช่องกรอกของตัวเอง การแก้พฤติกรรมเติมรหัสจาก SMS ก็ต้องแก้สองที่
 */
export function OtpCodeEntry({
  code,
  onChange,
  onResend,
  error,
  testIDPrefix = 'otp',
}: {
  code: string;
  onChange: (next: string) => void;
  onResend: () => Promise<void>;
  /** คีย์ i18n ของข้อความผิดพลาด null = ยังไม่มี */
  error: string | null;
  testIDPrefix?: string;
}) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const inputRef = useRef<TextInput>(null);
  /** วินาทีที่เหลือก่อนขอรหัสใหม่ได้ เซิร์ฟเวอร์บังคับ cooldown อยู่แล้ว อันนี้บอกผู้ใช้ให้รู้ตัว */
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    await onResend();
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <>
      {/* ช่องรหัส 6 ตัวตาม design ช่องกรอกจริงเป็น TextInput ใสวางทับทั้งแถว */}
      <Pressable
        testID={`${testIDPrefix}-boxes`}
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
          testID={`input-${testIDPrefix}-code`}
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
          onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64, opacity: 0 }}
        />
      </Pressable>

      {error ? (
        <Text testID={`${testIDPrefix}-error`} variant="small" color="danger" bold>
          {t(error)}
        </Text>
      ) : null}

      <Pressable
        testID={`btn-${testIDPrefix}-resend`}
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
    </>
  );
}
