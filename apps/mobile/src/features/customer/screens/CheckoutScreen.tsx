import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { IconChip } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import type { IconName } from '../../../ui/Icon';
import { useCartStore } from '../../cart/cartStore';
import { formatBaht } from '../../../lib/format';
import { usePlaceOrder, useDefaultAddress } from '../hooks';
import { usePaymentStore, PAYMENT_ICON } from '../../payment/paymentStore';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Checkout'>;

/** C17 ทวนออเดอร์ก่อนจ่าย: ที่อยู่ + ช่องทางจ่าย + ยอดแยกบรรทัด */
export function CheckoutScreen({ navigation }: Props) {
  const address = useDefaultAddress();
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const lineCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const method = usePaymentStore((s) => s.method);
  const { placeOrder, totals, isPending, canPlace } = usePlaceOrder();
  const [error, setError] = useState<string | null>(null);

  function handlePlaceOrder() {
    setError(null);
    // ต้องจ่ายก่อนถึงจะสร้างออเดอร์ได้ มีแค่เงินสดที่จ่ายปลายทาง จึงสั่งได้เลย
    if (method === 'promptpay') {
      navigation.navigate('PromptPay');
      return;
    }
    if (method === 'card') {
      navigation.navigate('CardPay');
      return;
    }
    placeOrder({
      onSuccess: (order) => navigation.replace('OrderPlaced', { orderId: order.id }),
      onError: setError,
    });
  }

  return (
    <SafeAreaView testID="screen-checkout" edges={['top', 'bottom']} style={{ flex: 1 }}>
      <ScreenHeader title={t('customer.checkout.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, gap: p.space.md }}
      >
        {/* ยังไม่มีที่อยู่ = สั่งไม่ได้ (เซิร์ฟเวอร์ปฏิเสธอยู่แล้ว) บอกตรงนี้ตั้งแต่ก่อนกดสั่ง */}
        <SummaryRow
          testID="row-address"
          icon="mapPin"
          tone="teal"
          kicker={t('customer.checkout.deliverTo')}
          value={address ? address.addressText : t('customer.addresses.emptyTitle')}
          actionLabel={address ? t('customer.checkout.change') : t('customer.addresses.add')}
          onPress={() => navigation.navigate(address ? 'Addresses' : 'AddAddress')}
        />

        <SummaryRow
          testID="row-payment"
          icon={PAYMENT_ICON[method]}
          tone="brand"
          kicker={t('customer.checkout.payWith')}
          value={t(`customer.payment.method.${method}.title`)}
          actionLabel={t('customer.checkout.change')}
          onPress={() => navigation.navigate('PaymentMethod')}
        />

        {/* ค่าอาหาร/ค่าส่ง/ค่าบริการ แยกบรรทัดเสมอ ห้ามรวมเข้าไปในราคาอาหาร (product-spec §3 ข้อ 2) */}
        <View
          style={[
            { backgroundColor: tokens.bgRaised, borderRadius: p.radius.lg, padding: p.space.lg },
            p.shadow.card,
          ]}
        >
          <TotalLine
            testID="line-food"
            label={`${t('customer.cart.foodTotal')} · ${lineCount} ${t('customer.restaurant.items')}`}
            value={formatBaht(totals.foodTotal)}
          />
          <TotalLine testID="line-delivery" label={t('customer.cart.deliveryFee')} value={formatBaht(totals.deliveryFee)} />
          <TotalLine testID="line-service" label={t('customer.cart.serviceFee')} value={formatBaht(totals.serviceFee)} last />

          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1.5,
              borderTopColor: tokens.borderSubtle,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text variant="bodyLg" bold>
              {t('customer.cart.grandTotal')}
            </Text>
            <Text testID="line-total" variant="bodyLg" color="link" bold>
              {formatBaht(totals.grandTotal)}
            </Text>
          </View>
        </View>

        {error ? (
          <Text testID="checkout-error" variant="small" color="danger" bold>
            {t(error, { defaultValue: error })}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, paddingTop: p.space.sm }}>
        <Button
          testID="btn-place-order"
          label={t('customer.cart.placeOrder')}
          trailingLabel={formatBaht(totals.grandTotal)}
          disabled={isPending || !canPlace || !address}
          loading={isPending}
          onPress={handlePlaceOrder}
        />
      </View>
    </SafeAreaView>
  );
}

/** แถวสรุปตาม C17: ชิปไอคอน + kicker + ค่า (+ ลิงก์ "เปลี่ยน" ถ้ากดได้) */
function SummaryRow({
  testID,
  icon,
  tone,
  kicker,
  value,
  actionLabel,
  onPress,
}: {
  testID: string;
  icon: IconName;
  tone: 'brand' | 'teal';
  kicker: string;
  value: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const { tokens, primitives: p } = useTheme();
  const body = (
    <>
      <IconChip name={icon} tone={tone} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="kicker" color="muted">
          {kicker}
        </Text>
        <Text variant="small" bold numberOfLines={1} style={{ marginTop: 2 }}>
          {value}
        </Text>
      </View>
      {actionLabel ? (
        <Text variant="caption" color="link" bold>
          {actionLabel}
        </Text>
      ) : null}
    </>
  );

  const style = [
    {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 13,
      backgroundColor: tokens.bgRaised,
      borderRadius: p.radius.lg,
      padding: 15,
    },
    p.shadow.card,
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={style}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...style, { opacity: pressed ? 0.9 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

function TotalLine({
  testID,
  label,
  value,
  last,
}: {
  testID: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: last ? 0 : 9,
      }}
    >
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="caption" bold>
        {value}
      </Text>
    </View>
  );
}
