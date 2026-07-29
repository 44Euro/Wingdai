import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';
import { Button } from '../../../ui/Button';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { canPayNowWithPromptPay } from '../../../lib/rules';
import { useOrder, useRestaurant } from '../hooks';
import { TrackingMap } from '../components/TrackingMap';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { OrderStatus } from '../../../data/types';

/** ลำดับสถานะที่ออร์เดอร์เดินผ่านตามปกติ — ยกเลิกไม่อยู่ในเส้นนี้ */
const TIMELINE: OrderStatus[] = ['created', 'accepted', 'preparing', 'picked_up', 'delivered'];

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderTracking'>;

/** C6 — แผนที่ + ไทม์ไลน์สถานะ + การ์ดร้าน + ยอดแยก 3 ก้อน */
export function OrderTrackingScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: order } = useOrder(route.params.orderId);
  const { data: restaurant } = useRestaurant(order?.restaurantId ?? '');

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
        <ScreenHeader title={t('customer.tracking.title')} onBack={() => navigation.goBack()} />
        <Text variant="small" color="muted" style={{ paddingHorizontal: p.space.screen }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  const reached = TIMELINE.indexOf(order.status);
  const total = order.foodTotal + order.deliveryFee + order.serviceFee;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('customer.tracking.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: p.space.screen, paddingTop: 0, gap: p.space.lg }}>
        <TrackingMap height={240} />

        <Card style={{ gap: p.space.md }}>
          <View style={{ gap: 2 }}>
            <Text testID="tracking-status" variant="h3">
              {t(`customer.tracking.status.${order.status}`)}
            </Text>
            <Text variant="caption" color="faint">
              {t('customer.tracking.orderNumber', { id: order.id })}
            </Text>
          </View>

          <View style={{ gap: p.space.sm }}>
            {TIMELINE.map((s, i) => (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    // จุดบอกความคืบหน้าไม่มีตัวหนังสือทับ จึงใช้สีส้มแบรนด์จริงได้
                    backgroundColor: i <= reached ? tokens.brandAccent : tokens.tealTint,
                  }}
                />
                <Text variant="small" color={i <= reached ? 'primary' : 'faint'}>
                  {t(`customer.tracking.status.${s}`)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ลูกค้าสั่งเงินสดแล้วเงินไม่พอ — ทางออกคือจ่ายเข้าแพลตฟอร์มตรง ๆ
            ไม่ใช่ให้ไรเดอร์ออกเงินแล้วค่อยโอนคืนเขา เหตุผลเต็มอยู่ที่ canPayNowWithPromptPay */}
        {canPayNowWithPromptPay(order) ? (
          <Card testID="tracking-switch-payment" style={{ gap: p.space.sm }}>
            <Text variant="body" bold>
              {t('customer.tracking.cashPending')}
            </Text>
            <Text variant="small" color="muted">
              {t('customer.tracking.switchToPromptPayHint')}
            </Text>
            <Button
              testID="btn-switch-promptpay"
              label={t('customer.tracking.switchToPromptPay')}
              variant="secondary"
              onPress={() => navigation.navigate('PromptPay', { orderId: order.id })}
            />
          </Card>
        ) : null}

        <Card style={{ gap: p.space.xs }}>
          <Text variant="kicker" color="muted">
            {t('customer.tracking.restaurant')}
          </Text>
          <Text testID="tracking-restaurant" variant="body" bold>
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

          {/* claude.md §3 ข้อ 2 — ค่าอาหาร/ค่าส่ง/ค่าบริการ ต้องแยกบรรทัดเสมอ ห้ามรวบเป็นก้อนเดียว */}
          <View testID="tracking-food-total" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="small" color="muted">
              {t('customer.tracking.foodTotal')}
            </Text>
            <Text variant="small">{formatBaht(order.foodTotal)}</Text>
          </View>
          <View testID="tracking-delivery-fee" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="small" color="muted">
              {t('customer.tracking.deliveryFee')}
            </Text>
            <Text variant="small">{formatBaht(order.deliveryFee)}</Text>
          </View>
          <View testID="tracking-service-fee" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="small" color="muted">
              {t('customer.tracking.serviceFee')}
            </Text>
            <Text variant="small">{formatBaht(order.serviceFee)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body" bold>
              {t('customer.tracking.total')}
            </Text>
            <Text variant="body" bold>
              {formatBaht(total)}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
