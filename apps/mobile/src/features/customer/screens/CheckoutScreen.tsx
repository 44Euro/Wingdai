import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { useCartStore } from '../../cart/cartStore';
import { orderTotals } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import { useCreateOrder } from '../hooks';
import { useAuthStore } from '../../auth/authStore';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Checkout'>;

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
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity })),
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
    <SafeAreaView testID="screen-checkout" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg }}>
        <Text variant="h2">{t('customer.checkout.payWithPromptPay')}</Text>

        {/* PromptPay QR แบบ mock — บล็อกทึบ ไม่ใช้ asset ลิขสิทธิ์จริง (claude.md §11.3 ใช้ mock) */}
        <View style={{ alignItems: 'center', gap: p.space.sm, backgroundColor: tokens.bgRaised, borderRadius: p.radius.lg, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.xl }}>
          <View style={{ width: 180, height: 180, borderRadius: p.radius.md, backgroundColor: tokens.textPrimary, opacity: 0.9 }} />
          <Text variant="small" color="muted">{t('customer.checkout.scanToPay')}</Text>
          <Text variant="h3">{formatBaht(totals.grandTotal)}</Text>
        </View>

        <View style={{ gap: p.space.xs }}>
          <Text variant="small" color="muted">{t('customer.checkout.amount')}: {formatBaht(totals.grandTotal)}</Text>
        </View>

        {error ? <Text testID="checkout-error" variant="small" style={{ color: tokens.danger }}>{t(error)}</Text> : null}

        <Button
          testID="btn-confirm-pay"
          label={t('customer.checkout.confirmPay')}
          disabled={createOrder.isPending || cart.lines.length === 0}
          onPress={confirm}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
