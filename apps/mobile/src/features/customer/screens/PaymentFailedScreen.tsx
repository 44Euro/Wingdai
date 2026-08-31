import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { usePaymentStore } from '../../payment/paymentStore';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'PaymentFailed'>;

/** SY4 จ่ายเงินไม่สำเร็จ ตะกร้ายังอยู่ครบ เงินยังไม่ถูกตัด */
export function PaymentFailedScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const method = usePaymentStore((s) => s.method);

  const orderId = route.params?.orderId;

  // ออร์เดอร์ที่ค้างอยู่จ่ายได้ทางพร้อมเพย์ทางเดียว ช่องทางที่ตั้งไว้ในโปรไฟล์ไม่เกี่ยว
  function retry() {
    if (orderId) return navigation.replace('PromptPay', { orderId });
    navigation.replace(method === 'card' ? 'CardPay' : 'PromptPay');
  }

  return (
    <SafeAreaView
      testID="screen-payment-failed"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: tokens.brandTint,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: p.space.xl,
          }}
        >
          <Icon name="card" color={tokens.danger} size={48} />
        </View>

        <Text variant="h2" style={{ textAlign: 'center' }}>{t('payment.failed.title')}</Text>
        <Text
          testID="payfail-body"
          variant="small"
          color="muted"
          style={{ textAlign: 'center', marginTop: p.space.md }}
        >
          {t('payment.failed.expired')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: p.space.lg, paddingBottom: p.space.lg, gap: p.space.sm }}>
        {/* กลับไปทางเดิมที่เขาเลือกไว้ ไม่ใช่บังคับให้เลือกช่องทางใหม่ทุกครั้ง */}
        <Button testID="btn-payfail-retry" label={t('payment.failed.retry')} onPress={retry} />
        <Button
          testID="btn-payfail-change"
          label={t('payment.failed.changeMethod')}
          variant="secondary"
          onPress={() => navigation.replace('PaymentMethod')}
        />
      </View>
    </SafeAreaView>
  );
}
