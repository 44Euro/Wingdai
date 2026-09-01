import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card, Badge } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { PressScale } from '../../../ui/motion';
import { formatBaht } from '../../../lib/format';
import { useRiderEarnings } from '../hooks';
import type { RiderDelivery, EarningsPeriod } from '../../../data/types';
import { RIDER_TAB_CLEARANCE } from '../../../app/navigators/RiderTabBar';
import type { RiderStackParamList, RiderTabParamList } from '../../../app/navigators/RiderStack';
import { groupByDay, bangkokDayKey } from '../../../lib/groupByDay';
import { DaySection, dayLabel } from '../../../ui/DaySection';


type Props = CompositeScreenProps<
  BottomTabScreenProps<RiderTabParamList, 'RiderEarnings'>,
  NativeStackScreenProps<RiderStackParamList>
>;

const PERIODS: EarningsPeriod[] = ['today', 'week', 'month'];

/** R4 + R6 รายได้และประวัติงานของไรเดอร์ */
export function RiderEarningsScreen() {
  const { t, i18n } = useTranslation();
  const todayKey = bangkokDayKey(new Date());
  const yesterdayKey = bangkokDayKey(new Date(Date.now() - 86_400_000));
  const dayLabels = { today: t('common.day.today'), yesterday: t('common.day.yesterday') };
  const { tokens, primitives: p } = useTheme();
  const [period, setPeriod] = useState<EarningsPeriod>('week');
  const { data, isLoading } = useRiderEarnings(period);

  return (
    <SafeAreaView
      testID="screen-rider-earnings"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.earnings.title')} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: RIDER_TAB_CLEARANCE, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ตัวกรองช่วงเวลา (design R6) สามชิปเรียงจากช่วงสั้นไปยาว */}
        <View style={{ flexDirection: 'row', gap: p.space.sm }}>
          {PERIODS.map((key) => {
            const on = period === key;
            return (
              <PressScale
                key={key}
                testID={`period-${key}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(`rider.earnings.period.${key}`)}
                onPress={() => setPeriod(key)}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: p.radius.full,
                    backgroundColor: on ? tokens.tealSolid : tokens.bgRaised,
                  }}
                >
                  <Text variant="body" bold color={on ? 'onTeal' : 'primary'}>
                    {t(`rider.earnings.period.${key}`)}
                  </Text>
                </View>
              </PressScale>
            );
          })}
        </View>

        {/* ยอดรวมของช่วง ตัวเลขใหญ่ตัวเดียวที่ไรเดอร์เปิดจอนี้มาหา */}
        <Card tone="teal">
          <View style={{ gap: p.space.xs }}>
            <Text variant="kicker" color="onTealMuted">
              {t(`rider.earnings.periodLabel.${period}`)}
            </Text>
            <Text variant="h1" color="onTeal" testID="earnings-total">
              {formatBaht(data?.totalPaySatang ?? 0)}
            </Text>
            <Text variant="small" color="onTealMuted">{t('rider.earnings.payNote')}</Text>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.md }}>
          <Stat
            testID="earnings-delivered"
            label={t('rider.earnings.delivered')}
            value={String(data?.delivered ?? 0)}
          />
          {/* ระยะรวมของช่วง บอกว่าค่าส่งที่ได้มาแลกมากับการวิ่งเท่าไหร่ */}
          <Stat
            testID="earnings-distance"
            label={t('rider.earnings.distance')}
            value={t('rider.earnings.km', { km: data?.distanceKm ?? 0 })}
          />
          <Stat
            testID="earnings-hours"
            label={t('rider.earnings.hours')}
            value={String(data?.hours ?? 0)}
          />
          {/* §8 North Star ยังไม่เคยออนไลน์จะได้ null ไม่ใช่ 0 และกฎของโปรเจกต์คือ */}
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
            /* จับกลุ่มตามวัน แทนรายการยาวเป็นพืดที่ดูไม่ออกว่าวันไหนเป็นวันไหน */
            groupByDay(data!.deliveries, (d) => d.deliveredAt, (d) => d.riderPaySatang)
              .map((group) => (
                <View key={group.key} style={{ gap: p.space.md }}>
                  <DaySection
                    testID={`earnings-day-${group.key}`}
                    label={dayLabel(group.key, todayKey, yesterdayKey, dayLabels, i18n.language)}
                    total={formatBaht(group.total)}
                  />
                  {group.items.map((d) => <DeliveryRow key={d.orderId} delivery={d} />)}
                </View>
              ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    // flexBasis 47% = สองใบต่อแถวบนจอมือถือ สี่ใบเรียงแถวเดียวจะเหลือใบละไม่ถึง 80pt
    <Card style={{ flexGrow: 1, flexBasis: '47%', padding: 14, borderRadius: 18 }} padded={false}>
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

  // ต่อเป็นสตริงเดียวก่อนเข้า <Text> เพื่อให้ตัดบรรทัดทั้งท่อน ไม่ใช่ตัดกลางคำว่า "กม."
  const tripLine = [
    t('rider.earnings.km', { km: delivery.distanceKm }),
    delivery.durationMinutes < 1
      ? t('rider.earnings.underMinute')
      : t('rider.earnings.minutes', { minutes: delivery.durationMinutes }),
  ].join(' · ');

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

        {/* ระยะและเวลาของเที่ยวนี้ เป็นบันทึกของงานที่ทำไปแล้ว ไม่ใช่เป้าหรือคะแนน */}
        <Text testID={`delivery-trip-${delivery.orderId}`} variant="small" color="muted">
          {tripLine}
        </Text>

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
