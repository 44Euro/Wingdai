import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { ChoiceCard } from '../../../ui/ChoiceCard';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useMerchantOrders, useUpdateOrderStatus } from '../hooks';
import type { CancelReason } from '../../../data/types';
import type { IconName } from '../../../ui/Icon';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'RejectOrder'>;

const REASONS: { key: CancelReason; icon: IconName }[] = [
  { key: 'out_of_stock', icon: 'cart' },
  { key: 'too_busy', icon: 'clock' },
  { key: 'closing_soon', icon: 'store' },
  { key: 'other', icon: 'help' },
];

/** M12 ปฏิเสธออร์เดอร์พร้อมเหตุผล */
export function RejectOrderScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: queue = [] } = useMerchantOrders('queue');
  const order = queue.find((o) => o.id === route.params.orderId);
  const update = useUpdateOrderStatus();

  const [reason, setReason] = useState<CancelReason | null>(null);

  const paid = order?.paymentStatus === 'paid';

  return (
    <SafeAreaView
      testID="screen-reject-order"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('merchant.reject.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.xl,
          gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {order ? (
          <Card>
            <View style={{ gap: 2 }}>
              <Text variant="body" bold>{order.reference}</Text>
              <Text variant="small" color="muted">
                {order.customerName} · {t('merchant.orders.items', {
                  count: order.items.reduce((s, i) => s + i.quantity, 0),
                })}
              </Text>
              <Text variant="small" color="muted">
                {order.items.map((i) => i.name).join(' · ')} · {formatBaht(order.foodTotal)}
              </Text>
            </View>
          </Card>
        ) : null}

        <Text variant="kicker" color="muted">{t('merchant.reject.why')}</Text>

        {REASONS.map((r) => (
          <ChoiceCard
            key={r.key}
            testID={`reason-${r.key}`}
            title={t(`merchant.reject.reason.${r.key}`)}
            description={t(`merchant.reject.reasonHint.${r.key}`)}
            icon={r.icon}
            selected={reason === r.key}
            onPress={() => setReason(r.key)}
          />
        ))}

        {/* บอกเรื่องเงินตรง ๆ ก่อนกด ไม่ใช่หลังกด ร้านต้องรู้ว่านี่ไม่ใช่การ "ซ่อนใบ" */}
        <Text testID="reject-refund-note" variant="small" color="muted">
          {paid ? t('merchant.reject.refundNote') : t('merchant.reject.noPaymentNote')}
        </Text>

        {update.isError ? (
          <Text testID="reject-error" variant="small" color="danger">
            {(update.error as Error).message}
          </Text>
        ) : null}

        <Button
          testID="btn-confirm-reject"
          label={t('merchant.reject.confirm')}
          disabled={!reason || update.isPending}
          onPress={() =>
            reason
            && update.mutate(
              { orderId: route.params.orderId, status: 'cancelled', reason },
              // กลับไปจอรายละเอียด ซึ่งจะแสดงสถานะใหม่ว่ายกเลิกแล้ว ปิดจอทิ้งเลย
              { onSuccess: () => navigation.goBack() },
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
