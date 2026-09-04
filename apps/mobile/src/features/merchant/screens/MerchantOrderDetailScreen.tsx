import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Badge, Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useMerchantOrders, useTicker, useUpdateOrderStatus } from '../hooks';
import { secondsLeftToAccept, acceptUrgency, ACCEPT_WINDOW_SECONDS } from '../acceptWindow';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'MerchantOrderDetail'>;

/** M2 รับ/ปฏิเสธออเดอร์ พร้อมนาฬิกานับถอยหลัง จอที่พังไม่ได้ */
export function MerchantOrderDetailScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  // อ่านจากคิวที่โหลดไว้แล้ว ไม่ยิงคำขอใหม่ จอนี้เปิดจากการ์ดในคิวเสมอ
  const { data: queue = [] } = useMerchantOrders('queue');
  const { data: history = [] } = useMerchantOrders('history');
  const order = [...queue, ...history].find((o) => o.id === route.params.orderId);

  const update = useUpdateOrderStatus();
  const isNew = order?.status === 'created';
  const now = useTicker(!!isNew);

  if (!order) {
    return (
      <SafeAreaView
        testID="screen-merchant-order-detail"
        edges={['top']}
        style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      >
        <ScreenHeader title={t('merchant.detail.title')} onBack={() => navigation.goBack()} />
        <View style={{ padding: p.space.screen }}>
          <Text testID="order-missing" variant="body" color="muted">
            {t('merchant.detail.missing')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const left = secondsLeftToAccept(order.createdAt, now);
  const urgency = acceptUrgency(left);
  const count = order.items.reduce((s, i) => s + i.quantity, 0);

  /** ปุ่มถัดไปตามสถานะ ตรงกับสิทธิ์ที่เซิร์ฟเวอร์ให้ร้าน (orders/authorize.ts) */
  const next =
    order.status === 'created'
      ? ('accepted' as const)
      : order.status === 'accepted'
        ? ('preparing' as const)
        : null;

  const run = (status: 'accepted' | 'preparing') =>
    update.mutate({ orderId: order.id, status }, { onSuccess: () => navigation.goBack() });

  return (
    <SafeAreaView
      testID="screen-merchant-order-detail"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={order.reference} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: p.space.xxl,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isNew ? (
          /** นาฬิกาใหญ่ ตัวเลขต้องอ่านออกจากระยะแขน เพราะครัวไม่ได้ถือมือถือไว้ตลอด */
          <Card tone={urgency === 'calm' ? 'raised' : 'teal'}>
            <View style={{ alignItems: 'center', gap: p.space.xs }}>
              <Text
                testID="accept-countdown"
                variant="display"
                color={urgency === 'calm' ? 'primary' : 'onTeal'}
                bold
              >
                {urgency === 'late' ? '0' : String(left)}
              </Text>
              <Text variant="small" color={urgency === 'calm' ? 'muted' : 'onTealMuted'}>
                {urgency === 'late'
                  ? t('merchant.detail.overdue')
                  : t('merchant.detail.secondsToAccept', { total: ACCEPT_WINDOW_SECONDS })}
              </Text>
            </View>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Badge label={t(`merchant.orders.status.${order.status}`)} tone="teal" />
          </View>
        )}

        <Card>
          <View style={{ gap: p.space.md }}>
            <View>
              <Text variant="kicker" color="muted">
                {t('merchant.detail.customer')}
              </Text>
              <Text variant="body" bold>
                {order.customerName}
              </Text>
            </View>

            <View style={{ gap: p.space.sm }}>
              <Text variant="kicker" color="muted">
                {t('merchant.orders.items', { count })}
              </Text>
              {order.items.map((i, idx) => (
                <View
                  key={`${i.name}-${idx}`}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.md }}
                >
                  <Text variant="body" style={{ flex: 1 }}>
                    {i.quantity}× {i.name}
                    {i.note ? (
                      <Text variant="small" color="brand" bold>
                        {'\n'}↳ {i.note}
                      </Text>
                    ) : null}
                  </Text>
                  <Text variant="body" color="muted">
                    {formatBaht(i.unitPrice * i.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* แยกสามบรรทัดให้ร้านเห็นว่าคอมมิชชันหักไปเท่าไหร่ ไม่ยุบเป็นยอดเดียว */}
        <Card>
          <View style={{ gap: p.space.sm }}>
            <Row label={t('merchant.detail.foodTotal')} value={formatBaht(order.foodTotal)} />
            <Row
              label={t('merchant.detail.commission')}
              value={`− ${formatBaht(order.commission)}`}
            />
            <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
            <Row label={t('merchant.orders.payout')} value={formatBaht(order.restaurantPayout)} bold />
            <Text variant="caption" color="faint">
              {t('merchant.detail.feesNote')}
            </Text>
          </View>
        </Card>

        {/* M10 ร้านทักลูกค้าได้ตอนใบยังเดินอยู่ เช่นของหมดต้องเปลี่ยนเมนู */}
        {next ? (
          <Button
            testID="btn-chat-customer"
            variant="secondary"
            label={t('chat.withCustomer')}
            onPress={() => navigation.navigate('MerchantChat', { orderId: order.id })}
          />
        ) : null}

        {next ? (
          <View style={{ gap: p.space.sm }}>
            <Button
              testID="btn-order-next"
              label={t(`merchant.detail.action.${next}`)}
              disabled={update.isPending}
              onPress={() => run(next)}
            />
            {order.status === 'created' ? (
              /** M12 ไปถามเหตุผลก่อน ไม่ยกเลิกทันทีจากปุ่มนี้ */
              <Button
                testID="btn-order-reject"
                variant="secondary"
                label={t('merchant.detail.action.reject')}
                disabled={update.isPending}
                onPress={() => navigation.navigate('RejectOrder', { orderId: order.id })}
              />
            ) : null}
          </View>
        ) : null}

        {update.isError ? (
          <Text testID="order-action-error" variant="small" color="danger">
            {errorText(update.error, t, i18n.language)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" color={bold ? 'primary' : 'muted'} bold={bold}>
        {label}
      </Text>
      <Text variant="body" bold={bold}>
        {value}
      </Text>
    </View>
  );
}
