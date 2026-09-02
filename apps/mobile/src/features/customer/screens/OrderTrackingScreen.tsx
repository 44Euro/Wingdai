import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';
import { Button } from '../../../ui/Button';
import { isActiveStatus } from '../../../data/orderStateMachine';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { canPayNowWithPromptPay, canCancelOrder, refundDueOnCancel } from '../../../lib/rules';
import {
  useOrder, useRestaurant, useUpdateOrderStatus, useDeliveryRoute, useSmoothedRiderPosition,
} from '../hooks';
import { TrackingMap } from '../components/TrackingMap';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { OrderStatus } from '../../../data/types';
import { SkeletonCards } from '../../../ui/motion';

/** ลำดับสถานะที่ออเดอร์เดินผ่านตามปกติ ยกเลิกไม่อยู่ในเส้นนี้ */
const TIMELINE: OrderStatus[] = ['created', 'accepted', 'preparing', 'picked_up', 'delivered'];

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderTracking'>;

/** C6 แผนที่ + ไทม์ไลน์สถานะ + การ์ดร้าน + ยอดแยก 3 ก้อน */
export function OrderTrackingScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: order } = useOrder(route.params.orderId);
  const { data: restaurant } = useRestaurant(order?.restaurantId ?? '');
  const cancel = useUpdateOrderStatus();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  /** เส้นทางดึงครั้งเดียวต่อออเดอร์ (§5 ห้ามยิง routing API ต่อรายการ) */
  const { data: deliveryRoute } = useDeliveryRoute(order);
  const riderAt = useSmoothedRiderPosition(order?.riderLocation ?? null);

  if (!order) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
        <ScreenHeader title={t('customer.tracking.title')} onBack={() => navigation.goBack()} />
        <SkeletonCards testID="list-loading" count={3} photoHeight={0} />
      </SafeAreaView>
    );
  }

  const reached = TIMELINE.indexOf(order.status);
  const total = order.foodTotal + order.deliveryFee + order.serviceFee;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('customer.tracking.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: p.space.screen, paddingTop: 0, gap: p.space.lg }}>
        <TrackingMap
          height={240}
          restaurant={
            order.restaurantLat !== null && order.restaurantLng !== null
              ? { lat: order.restaurantLat, lng: order.restaurantLng }
              : null
          }
          dropoff={
            order.dropoffLat !== null && order.dropoffLng !== null
              ? { lat: order.dropoffLat, lng: order.dropoffLng }
              : null
          }
          rider={riderAt}
          route={deliveryRoute ?? null}
        />

        <Card style={{ gap: p.space.md }}>
          <View style={{ gap: 2 }}>
            <Text testID="tracking-status" variant="h3">
              {t(`customer.tracking.status.${order.status}`)}
            </Text>
            <Text variant="caption" color="faint">
              {t('customer.tracking.orderNumber', { id: order.reference })}
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

        {/* M12 ใบที่ถูกยกเลิกต้องบอกว่าใครยกเลิกและเพราะอะไร */}
        {order.status === 'cancelled' ? (
          <Card testID="tracking-cancelled" style={{ gap: p.space.xs }}>
            <Text variant="body" bold>
              {t(`customer.tracking.cancelledBy.${order.cancelledBy ?? 'customer'}`)}
            </Text>
            {order.cancelReason ? (
              <Text testID="tracking-cancel-reason" variant="small" color="muted">
                {t(`customer.tracking.cancelReason.${order.cancelReason}`)}
              </Text>
            ) : null}
            {order.paymentStatus === 'refunded' ? (
              <Text testID="tracking-refunded" variant="small" color="muted">
                {t('customer.tracking.refunded')}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* R11 รหัสยืนยันส่ง โผล่ตอนอาหารออกจากร้านแล้วเท่านั้น */}
        {order.deliveryPin && order.status === 'picked_up' ? (
          <Card testID="tracking-delivery-pin" tone="teal" style={{ gap: p.space.xs }}>
            <Text variant="kicker" color="onTealMuted">
              {t('customer.tracking.pinLabel')}
            </Text>
            <Text
              variant="h1"
              color="onTeal"
              testID="tracking-pin-value"
              style={{ letterSpacing: 8, fontVariant: ['tabular-nums'] }}
            >
              {order.deliveryPin}
            </Text>
            <Text variant="small" color="onTealMuted">
              {t('customer.tracking.pinHint')}
            </Text>
          </Card>
        ) : null}

        {/* ลูกค้าสั่งเงินสดแล้วเงินไม่พอ ทางออกคือจ่ายเข้าแพลตฟอร์มตรง ๆ */}
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

        {/* C10 แชท ปุ่มคุยกับไรเดอร์โผล่ก็ต่อเมื่อมีไรเดอร์แล้วจริง ๆ */}
        {isActiveStatus(order.status) ? (
          <Card style={{ gap: p.space.sm }}>
            <Text variant="kicker" color="muted">{t('chat.title')}</Text>
            {order.riderId ? (
              <Button
                testID="btn-chat-rider"
                variant="secondary"
                label={t('chat.withRider')}
                onPress={() =>
                  navigation.navigate('OrderChat', { orderId: order.id, channel: 'customer_rider' })}
              />
            ) : null}
            <Button
              testID="btn-chat-merchant"
              variant="secondary"
              label={t('chat.withMerchant')}
              onPress={() =>
                navigation.navigate('OrderChat', { orderId: order.id, channel: 'customer_merchant' })}
            />
          </Card>
        ) : null}

        {/* C27 ยกเลิกได้ถึงก่อนไรเดอร์รับของเท่านั้น (canCancelOrder) */}
        {canCancelOrder(order) ? (
          <Card testID="tracking-cancel" style={{ gap: p.space.sm }}>
            {confirmingCancel ? (
              <>
                <Text variant="body" bold>{t('customer.tracking.cancelConfirmTitle')}</Text>
                {/* บอกล่วงหน้าว่าเงินจะกลับมาเท่าไหร่ ไม่ใช่ให้กดแล้วลุ้นเอง */}
                <Text variant="small" color="muted">
                  {refundDueOnCancel(order) > 0
                    ? t('customer.tracking.cancelRefundHint', {
                        amount: formatBaht(refundDueOnCancel(order)),
                      })
                    : t('customer.tracking.cancelNoChargeHint')}
                </Text>
                {order.status === 'preparing' ? (
                  <Text testID="cancel-cooking-warning" variant="small" color="danger">
                    {t('customer.tracking.cancelCookingWarning')}
                  </Text>
                ) : null}
                <Button
                  testID="btn-cancel-confirm"
                  label={t('customer.tracking.cancelConfirm')}
                  disabled={cancel.isPending}
                  onPress={() => cancel.mutate({ orderId: order.id, status: 'cancelled' })}
                />
                <Button
                  testID="btn-cancel-dismiss"
                  variant="secondary"
                  label={t('customer.tracking.cancelKeep')}
                  onPress={() => setConfirmingCancel(false)}
                />
              </>
            ) : (
              <Button
                testID="btn-cancel-order"
                variant="secondary"
                label={t('customer.tracking.cancel')}
                onPress={() => setConfirmingCancel(true)}
              />
            )}
            {cancel.isError ? (
              <Text testID="cancel-error" variant="small" color="danger">
                {errorText(cancel.error, t, i18n.language)}
              </Text>
            ) : null}
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

          {/* product-spec §3 ข้อ 2 ค่าอาหาร/ค่าส่ง/ค่าบริการ ต้องแยกบรรทัดเสมอ ห้ามรวบเป็นก้อนเดียว */}
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
    </SafeAreaView>
  );
}
