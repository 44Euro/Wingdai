import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { RoundButton } from '../../../ui/Surface';
import { Icon } from '../../../ui/Icon';
import { formatBaht } from '../../../lib/format';
import { usePlaceOrder } from '../hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CardPay'>;

/** จอชำระด้วยบัตร คู่ขนานกับจอพร้อมเพย์ (C5) และ จำลองเท่ากัน เพราะยังไม่ได้เลือก */
export function CardPayScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { placeOrder, totals, isPending, canPlace } = usePlaceOrder();
  const [error, setError] = useState<string | null>(null);

  function handlePay() {
    setError(null);
    placeOrder({
      onSuccess: (order) => navigation.replace('OrderPlaced', { orderId: order.id }),
      onError: () => setError('order.error.ownRestaurant'),
    });
  }

  return (
    // พื้น teal เต็มจอเหมือนจอชำระเงินอื่น ไม่ผูกกับโหมดสว่าง/มืด
    <SafeAreaView
      testID="screen-cardpay"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.tealSolid }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: p.space.md,
          paddingHorizontal: p.space.screen,
          paddingTop: p.space.sm,
          paddingBottom: p.space.xs,
        }}
      >
        <RoundButton
          icon="chevronLeft"
          tone="onDark"
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <Text variant="h3" color="onTeal">
          {t('customer.card.title')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.xl,
          alignItems: 'center',
          paddingBottom: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" color="onTealMuted" style={{ marginTop: p.space.md }}>
          {t('customer.card.amount')}
        </Text>
        <Text testID="cardpay-amount" variant="display" color="onTeal" style={{ marginTop: 2 }}>
          {formatBaht(totals.grandTotal)}
        </Text>

        {/* บัตรทดสอบ ตัวเลขคงที่ ไม่ใช่ช่องกรอก ดูเหตุผลในคอมเมนต์หัวไฟล์ */}
        <View
          style={[
            {
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: p.space.lg,
              marginTop: p.space.xl,
              gap: p.space.lg,
            },
            p.shadow.teal,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: tokens.brandAccent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="card" color={tokens.textOnBrand} size={22} strokeWidth={2} />
            </View>
            <Text variant="caption" style={{ color: '#7A7370' }}>
              {t('customer.card.testCard')}
            </Text>
          </View>

          <Text testID="cardpay-number" variant="h3" style={{ color: '#1B1917', letterSpacing: 2 }}>
            •••• •••• •••• 4242
          </Text>

          <View style={{ flexDirection: 'row', gap: p.space.xl }}>
            <View>
              <Text variant="caption" style={{ color: '#7A7370' }}>
                {t('customer.card.expiry')}
              </Text>
              <Text variant="small" bold style={{ color: '#1B1917' }}>
                12/30
              </Text>
            </View>
            <View>
              <Text variant="caption" style={{ color: '#7A7370' }}>
                {t('customer.card.cvc')}
              </Text>
              <Text variant="small" bold style={{ color: '#1B1917' }}>
                •••
              </Text>
            </View>
          </View>
        </View>

        <Text variant="caption" color="onTealMuted" style={{ marginTop: p.space.lg, textAlign: 'center' }}>
          {t('customer.card.mockNote')}
        </Text>

        {error ? (
          <Text
            testID="cardpay-error"
            variant="small"
            bold
            style={{ color: '#FFB4AB', marginTop: p.space.md, textAlign: 'center' }}
          >
            {t(error)}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.xl, paddingBottom: p.space.lg, paddingTop: p.space.sm }}>
        <Button
          testID="btn-card-pay"
          label={t('customer.card.pay')}
          variant="ghostOnDark"
          disabled={isPending || !canPlace}
          onPress={handlePay}
        />
      </View>
    </SafeAreaView>
  );
}
