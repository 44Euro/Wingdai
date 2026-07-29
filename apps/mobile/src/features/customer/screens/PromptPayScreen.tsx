import React, { useEffect, useState } from 'react';
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
import { usePlaceOrder, useOrder, usePayWithPromptPay } from '../hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'PromptPay'>;

/** ลาย QR จำลอง ไม่ใช่ QR จริง ใช้คู่กับข้อความ "(ตัวอย่าง)" จนกว่าจะเลือก payment gateway (product-spec §11.3) */
const QR_GRID = 13;
const QR_CELL = 14;

function qrCell(row: number, col: number) {
  // แพตเทิร์นคงที่ (ไม่สุ่มตอน render) เพื่อไม่ให้ลายเปลี่ยนทุกครั้งที่ re-render
  const isFinder =
    (row < 3 && col < 3) || (row < 3 && col >= QR_GRID - 3) || (row >= QR_GRID - 3 && col < 3);
  if (isFinder) return (row + col) % 2 === 0 || row === 0 || col === 0;
  return (row * 7 + col * 11 + ((row * col) % 5)) % 3 !== 0;
}

/** QR พร้อมเพย์ของจริงมีอายุจำกัด design C5 นับถอยหลัง 5 นาที */
const EXPIRY_SECONDS = 5 * 60;

export function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, secondsLeft);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** C5 จอสแกน PromptPay พื้น teal เต็มจอ */
export function PromptPayScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { placeOrder, totals, isPending, canPlace } = usePlaceOrder();
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const [error, setError] = useState<string | null>(null);

  const orderId = route.params?.orderId;
  const { data: pendingOrder } = useOrder(orderId ?? '');
  const payExisting = usePayWithPromptPay();

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const expired = secondsLeft === 0;
  const amount = pendingOrder
    ? pendingOrder.foodTotal + pendingOrder.deliveryFee + pendingOrder.serviceFee
    : totals.grandTotal;
  // โหมดจ่ายออร์เดอร์เก่าไม่เกี่ยวกับตะกร้า ตะกร้าว่างไม่ควรทำให้ปุ่มกดไม่ได้
  const busy = isPending || payExisting.isPending;
  const canConfirm = orderId ? !!pendingOrder : canPlace;

  function handlePaid() {
    if (orderId) {
      payExisting.mutate(orderId, {
        onSuccess: () => navigation.goBack(),
        onError: () => setError('payment.error.cannotSwitch'),
      });
      return;
    }
    placeOrder({
      onSuccess: (order) => navigation.replace('OrderPlaced', { orderId: order.id }),
      // เหตุผลเดียวที่ถูกบล็อกในเส้นทางสั่งของคือ guard สั่งร้านตัวเอง (map เป็น i18n key เดียว)
      onError: () => setError('order.error.ownRestaurant'),
    });
  }

  return (
    // จอชำระเงินเป็นพื้น teal เต็มจอตาม design ไม่ผูกกับโหมดสว่าง/มืด
    <SafeAreaView
      testID="screen-promptpay"
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
          {t('customer.promptpay.title')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: p.space.xl, alignItems: 'center', paddingBottom: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" color="onTealMuted" style={{ marginTop: p.space.md }}>
          {t('customer.promptpay.amount')}
        </Text>
        <Text testID="promptpay-amount" variant="display" color="onTeal" style={{ marginTop: 2 }}>
          {formatBaht(amount)}
        </Text>

        {/* PromptPay QR แบบ mock ลายจำลอง ไม่ใช่ QR ที่สแกนได้ */}
        <View
          style={[
            {
              backgroundColor: '#FFFFFF',
              borderRadius: 26,
              padding: p.space.xl,
              marginTop: p.space.xl,
              opacity: expired ? 0.35 : 1,
            },
            p.shadow.teal,
          ]}
        >
          <View style={{ width: QR_GRID * QR_CELL, height: QR_GRID * QR_CELL, flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: QR_GRID * QR_GRID }).map((_, i) => {
              const row = Math.floor(i / QR_GRID);
              const col = i % QR_GRID;
              return (
                <View
                  key={i}
                  style={{
                    width: QR_CELL,
                    height: QR_CELL,
                    backgroundColor: qrCell(row, col) ? '#1B1917' : '#FFFFFF',
                  }}
                />
              );
            })}
          </View>
        </View>

        <Text variant="small" color="onTealMuted" style={{ marginTop: p.space.lg, textAlign: 'center' }}>
          {t('customer.promptpay.scanHint')}
        </Text>

        {/* แถบนับถอยหลังอายุ QR ตาม C5 */}
        <View
          style={{
            marginTop: p.space.lg,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: p.space.md,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 18,
            paddingHorizontal: 18,
            paddingVertical: 15,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: tokens.brandAccent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="clock" color={tokens.textOnBrand} size={18} strokeWidth={2} />
            </View>
            <Text variant="caption" color="onTealMuted">
              {t(expired ? 'customer.promptpay.expired' : 'customer.promptpay.expiresIn')}
            </Text>
          </View>
          <Text testID="promptpay-countdown" variant="h3" color="onTeal">
            {formatCountdown(secondsLeft)}
          </Text>
        </View>

        <Text variant="caption" color="onTealMuted" style={{ marginTop: p.space.md, textAlign: 'center' }}>
          {t('customer.promptpay.mockNote')}
        </Text>

        {error ? (
          <Text
            testID="promptpay-error"
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
          testID="btn-paid"
          label={t('customer.promptpay.paid')}
          variant="ghostOnDark"
          disabled={expired || busy || !canConfirm}
          onPress={handlePaid}
        />
      </View>
    </SafeAreaView>
  );
}
