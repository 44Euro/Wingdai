import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card, Badge } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useRiderEarnings } from '../hooks';
import type { RiderDelivery } from '../../../data/types';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderEarnings'>;

/**
 * R4 + R6 — รายได้และประวัติงานของไรเดอร์
 *
 * รวมสองจอของ design ไว้ที่เดียวเพราะรายการงานที่ส่งสำเร็จ **คือ** ที่มาของตัวเลขรายได้
 * แยกเป็นสองจอแล้วผู้ใช้ต้องเด้งไปมาเพื่อตอบคำถามเดียว ("เงินนี้มาจากไหน")
 *
 * claude.md §3 ข้อ 4 — ห้ามมีอันดับ เป้ารายวัน หรือการเทียบกับไรเดอร์คนอื่นบนจอนี้
 * ตัวเลขที่โชว์ได้คือสิ่งที่เกิดขึ้นจริงของคนคนนี้เท่านั้น
 */
export function RiderEarningsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data, isLoading } = useRiderEarnings();

  return (
    <SafeAreaView
      testID="screen-rider-earnings"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.earnings.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ยอดรวมของช่วง — ตัวเลขใหญ่ตัวเดียวที่ไรเดอร์เปิดจอนี้มาหา */}
        <Card tone="teal">
          <View style={{ gap: p.space.xs }}>
            <Text variant="kicker" color="onTealMuted">
              {t('rider.earnings.periodLabel', { days: data?.sinceDays ?? 7 })}
            </Text>
            <Text variant="h1" color="onTeal" testID="earnings-total">
              {formatBaht(data?.totalPaySatang ?? 0)}
            </Text>
            <Text variant="small" color="onTealMuted">{t('rider.earnings.payNote')}</Text>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: p.space.md }}>
          <Stat
            testID="earnings-delivered"
            label={t('rider.earnings.delivered')}
            value={String(data?.delivered ?? 0)}
          />
          <Stat
            testID="earnings-hours"
            label={t('rider.earnings.hours')}
            value={String(data?.hours ?? 0)}
          />
          {/*
            §8 North Star — ยังไม่เคยออนไลน์จะได้ null ไม่ใช่ 0 และกฎของโปรเจกต์คือ
            "ไม่รู้" ต้องแสดงเป็นไม่มีข้อมูล ห้ามเอา 0 มาหลอกว่าเป็นค่าที่วัดได้
          */}
          <Stat
            testID="earnings-per-hour"
            label={t('rider.earnings.perHour')}
            value={data?.ordersPerHour === null || data?.ordersPerHour === undefined
              ? '—'
              : String(data.ordersPerHour)}
          />
        </View>

        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">{t('rider.earnings.history')}</Text>

          {isLoading ? (
            <Text variant="body" color="muted">{t('common.loading')}</Text>
          ) : (data?.deliveries.length ?? 0) === 0 ? (
            <Card>
              <Text testID="earnings-empty" variant="body" color="muted">
                {t('rider.earnings.empty')}
              </Text>
            </Card>
          ) : (
            data!.deliveries.map((d) => <DeliveryRow key={d.orderId} delivery={d} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <Card style={{ flex: 1, padding: 14, borderRadius: 18 }} padded={false}>
      <View style={{ gap: 2 }}>
        <Text variant="h3" testID={testID}>{value}</Text>
        <Text variant="caption" color="muted" numberOfLines={2}>{label}</Text>
      </View>
    </Card>
  );
}

function DeliveryRow({ delivery }: { delivery: RiderDelivery }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const at = new Date(delivery.deliveredAt);

  return (
    <Card testID={`delivery-${delivery.orderId}`}>
      <View style={{ gap: p.space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.sm }}>
          <Text variant="body" bold style={{ flex: 1 }} numberOfLines={1}>
            {delivery.restaurantName}
          </Text>
          {/* ค่าส่งของใบนี้ = สิ่งที่ไรเดอร์ได้ ไม่ใช่ยอดที่ลูกค้าจ่าย */}
          <Text variant="body" bold color="success">{formatBaht(delivery.riderPaySatang)}</Text>
        </View>

        <Text variant="small" color="muted" numberOfLines={1}>{delivery.dropoffAddress}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
          <Text variant="caption" color="faint">
            {delivery.reference} · {at.toLocaleString()}
          </Text>
          {delivery.paymentMethod === 'cash' ? (
            <Badge label={t('rider.earnings.paidCash')} tone="neutral" />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
