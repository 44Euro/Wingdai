import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Badge, Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { Button } from '../../../ui/Button';
import { formatBaht } from '../../../lib/format';
import { useOrder, useRestaurant } from '../hooks';
import { PAYMENT_ICON } from '../../payment/paymentStore';
import { IconChip } from '../../../ui/Surface';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import { SkeletonCards } from '../../../ui/motion';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Receipt'>;

/** วันเวลาแบบอ่านง่าย ใช้ locale ของเครื่อง จึงตรงกับภาษาที่ผู้ใช้เห็นในแอป */
function formatWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** C14 ใบเสร็จ */
export function ReceiptScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: order } = useOrder(route.params.orderId);
  const { data: restaurant } = useRestaurant(order?.restaurantId ?? '');

  if (!order) {
    return (
      <SafeAreaView testID="screen-receipt" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
        <ScreenHeader title={t('customer.receipt.title')} onBack={() => navigation.goBack()} />
        <SkeletonCards testID="list-loading" count={3} photoHeight={0} />
      </SafeAreaView>
    );
  }

  const total = order.foodTotal + order.deliveryFee + order.serviceFee;

  return (
    <SafeAreaView testID="screen-receipt" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('customer.receipt.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: p.space.screen, paddingTop: 0, gap: p.space.md }}>
        <Card style={{ gap: p.space.xs, alignItems: 'center' }}>
          <Text variant="kicker" color="muted">
            {t('customer.receipt.orderNumber')}
          </Text>
          {/* เลขที่ที่ลูกค้าใช้อ้างตอนแจ้งปัญหา ต้องเด่นและอ่านออกทางโทรศัพท์ได้ */}
          <Text testID="receipt-reference" variant="h2">
            {order.reference}
          </Text>
          <Text variant="caption" color="faint">
            {formatWhen(order.createdAt, i18n.language)}
          </Text>
          <Badge
            label={t(`customer.orders.status.${order.status}`)}
            tone={order.status === 'delivered' ? 'teal' : 'brand'}
          />
        </Card>

        <Card style={{ gap: p.space.xs }}>
          <Text variant="kicker" color="muted">
            {t('customer.tracking.restaurant')}
          </Text>
          <Text testID="receipt-restaurant" variant="body" bold>
            {restaurant?.name ?? ''}
          </Text>
        </Card>

        <Card style={{ gap: p.space.sm }}>
          {order.items.map((it) => (
            <View
              key={`${it.menuItemId}-${it.name}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.md }}
            >
              <Text variant="small" style={{ flex: 1 }}>
                {it.quantity}× {it.name}
              </Text>
              <Text variant="small">{formatBaht(it.unitPrice * it.quantity)}</Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginVertical: p.space.xs }} />

          {/* product-spec §3 ข้อ 2 ค่าอาหาร/ค่าส่ง/ค่าบริการ แยกบรรทัดเสมอ ห้ามรวบเป็นก้อนเดียว */}
          <FeeRow testID="receipt-food-total" label={t('customer.tracking.foodTotal')} value={order.foodTotal} />
          <FeeRow testID="receipt-delivery-fee" label={t('customer.tracking.deliveryFee')} value={order.deliveryFee} />
          <FeeRow testID="receipt-service-fee" label={t('customer.tracking.serviceFee')} value={order.serviceFee} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: p.space.xs }}>
            <Text variant="body" bold>
              {t('customer.tracking.total')}
            </Text>
            <Text testID="receipt-total" variant="body" bold>
              {formatBaht(total)}
            </Text>
          </View>
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
          <IconChip name={PAYMENT_ICON[order.paymentMethod]} tone="brand" size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="small" bold>
              {t(`customer.payment.method.${order.paymentMethod}.title`)}
            </Text>
            <Text testID="receipt-payment-status" variant="caption" color="muted">
              {t(`customer.receipt.paymentStatus.${order.paymentStatus}`)}
            </Text>
          </View>
        </Card>
        {/* ทางเข้าเดียวของการแจ้งปัญหา (§6.4) ไม่มีปุ่มนี้ = เซิร์ฟเวอร์รับเรื่องได้ */}
        {order.status === 'delivered' ? (
          <Button
            testID="btn-report-problem"
            variant="secondary"
            label={t('customer.report.entry')}
            onPress={() => navigation.navigate('ReportProblem', { orderId: order.id })}
          />
        ) : null}

        {/* C11 ให้คะแนน ทางเข้าเดียวของการรีวิว และอยู่ที่นี่เพราะใบเสร็จเป็นจุดเดียว */}
        {order.status === 'delivered' ? (
          <Button
            testID="btn-rate-order"
            variant="secondary"
            label={t('customer.rate.entry')}
            onPress={() => navigation.navigate('RateOrder', { orderId: order.id })}
          />
        ) : null}

        {/* AD4 คุยกับคน สำหรับเรื่องที่ไม่ใช่ "ขอเงินคืน" (สั่งผิด อยากถามอะไรสักอย่าง) */}
        <Button
          testID="btn-support-order"
          variant="secondary"
          label={t('support.aboutThisOrder')}
          onPress={() => navigation.navigate('Support', { orderId: order.id })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function FeeRow({ testID, label, value }: { testID: string; label: string; value: number }) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="small" color="muted">
        {label}
      </Text>
      <Text variant="small">{formatBaht(value)}</Text>
    </View>
  );
}
