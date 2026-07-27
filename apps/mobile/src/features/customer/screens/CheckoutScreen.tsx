import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { RoundButton } from '../../../ui/Surface';
import { useCartStore } from '../../cart/cartStore';
import { orderTotals, orderItemName } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import { useCreateOrder } from '../hooks';
import { useAuthStore } from '../../auth/authStore';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Checkout'>;

/** ลาย QR จำลอง — ไม่ใช่ QR จริง ใช้คู่กับข้อความ "(ตัวอย่าง)" จนกว่าจะเลือก payment gateway (claude.md §11.3) */
const QR_GRID = 13;
function qrCell(row: number, col: number) {
  // แพตเทิร์นคงที่ (ไม่สุ่มตอน render) เพื่อไม่ให้ลายเปลี่ยนทุกครั้งที่ re-render
  const isFinder =
    (row < 3 && col < 3) || (row < 3 && col >= QR_GRID - 3) || (row >= QR_GRID - 3 && col < 3);
  if (isFinder) return (row + col) % 2 === 0 || row === 0 || col === 0;
  return ((row * 7 + col * 11 + ((row * col) % 5)) % 3) !== 0;
}

export function CheckoutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const cart = useCartStore();
  const account = useAuthStore((s) => s.account);
  const createOrder = useCreateOrder();
  const totals = orderTotals(cart.foodTotal());
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!cart.restaurantId || !account) return;
    setError(null);
    createOrder.mutate(
      {
        customerId: account.id,
        restaurantId: cart.restaurantId,
        items: cart.lines.map((l) => ({
          menuItemId: l.menuItemId,
          name: orderItemName(l.name, l.selectedChoices),
          unitPrice: l.unitPrice,
          quantity: l.quantity,
        })),
        deliveryFee: totals.deliveryFee,
        serviceFee: totals.serviceFee,
      },
      {
        onSuccess: (order) => {
          cart.clear();
          navigation.replace('OrderPlaced', { orderId: order.id });
        },
        onError: () => {
          // เหตุผลเดียวที่ถูกบล็อกใน slice นี้คือ guard สั่งร้านตัวเอง (map เป็น i18n key เดียว)
          setError('order.error.ownRestaurant');
        },
      },
    );
  }

  return (
    // จอชำระเงินเป็นพื้น teal เต็มจอตาม design — ไม่ผูกกับโหมดสว่าง/มืด
    <SafeAreaView testID="screen-checkout" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.tealSolid }}>
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
        <RoundButton icon="chevronLeft" tone="onDark" onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')} />
        <Text variant="h3" color="onTeal">{t('customer.checkout.payWithPromptPay')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: p.space.xl, alignItems: 'center', paddingBottom: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" style={{ color: 'rgba(255,255,255,0.62)', marginTop: p.space.md }}>
          {t('customer.checkout.amount')}
        </Text>
        <Text variant="display" color="onTeal" style={{ marginTop: 2 }}>
          {formatBaht(totals.grandTotal)}
        </Text>

        {/* PromptPay QR แบบ mock — ลายจำลอง ไม่ใช่ QR ที่สแกนได้ */}
        <View
          style={[
            {
              backgroundColor: '#FFFFFF',
              borderRadius: p.radius.xl,
              padding: p.space.xl,
              marginTop: p.space.xl,
            },
            p.shadow.teal,
          ]}
        >
          <View style={{ width: 13 * 14, height: 13 * 14, flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: QR_GRID * QR_GRID }).map((_, i) => {
              const row = Math.floor(i / QR_GRID);
              const col = i % QR_GRID;
              return (
                <View
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: qrCell(row, col) ? '#1B1917' : '#FFFFFF',
                  }}
                />
              );
            })}
          </View>
        </View>

        <Text variant="small" style={{ color: 'rgba(255,255,255,0.72)', marginTop: p.space.lg, textAlign: 'center' }}>
          {t('customer.checkout.scanToPay')}
        </Text>

        {error ? (
          <Text testID="checkout-error" variant="small" bold style={{ color: '#FFB4AB', marginTop: p.space.md, textAlign: 'center' }}>
            {t(error)}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.xl, paddingBottom: p.space.lg, paddingTop: p.space.sm }}>
        <Button
          testID="btn-confirm-pay"
          label={t('customer.checkout.confirmPay')}
          disabled={createOrder.isPending || cart.lines.length === 0}
          onPress={confirm}
        />
      </View>
    </SafeAreaView>
  );
}
