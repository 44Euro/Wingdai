import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { ScreenHeader } from '../../ui/ScreenHeader';
import type { AuthStackParamList } from './AuthNavigator';

// เบอร์มือถือไทย: ขึ้นต้น 0 แล้วตามด้วย 6/8/9 แล้วอีก 8 หลัก รวม 10 หลัก
const PHONE_PATTERN = /^0[689]\d{8}$/;

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSendReset() {
    if (!phone.trim()) {
      setError('auth.register.phoneInvalid');
      setSent(false);
      return;
    }

    if (!PHONE_PATTERN.test(phone.trim())) {
      setError('auth.register.phoneInvalid');
      setSent(false);
      return;
    }

    // Mock: ยังไม่เรียก reset จริง — เพียงแสดงข้อความสำเร็จ (Phase 1)
    setError(null);
    setSent(true);
  }

  return (
    <SafeAreaView
      testID="screen-forgot-password"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('auth.forgot.title')} onBack={() => navigation.goBack()} />

      <View style={{ flex: 1, paddingHorizontal: p.space.screen, gap: p.space.lg }}>
        <Text variant="body" color="muted">{t('auth.forgot.description')}</Text>

        <Field label={t('auth.register.phone')}>
          <Input
            testID="input-phone"
            accessibilityLabel={t('auth.forgot.title')}
            placeholder={t('auth.register.phone')}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </Field>

        {error ? (
          <Text testID="forgot-error" variant="small" color="danger" bold>
            {t(error)}
          </Text>
        ) : null}

        {sent ? (
          <Text testID="forgot-sent" variant="small" color="success" bold>
            {t('auth.forgot.sent')}
          </Text>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, gap: p.space.sm }}>
        <Button testID="btn-send-reset" label={t('auth.forgot.submit')} onPress={handleSendReset} />

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
