import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip } from '../../../ui/Surface';
import { SkeletonCards } from '../../../ui/motion';
import { formatBaht } from '../../../lib/format';
import { useMerchantSummary, useMerchantOrders } from '../hooks';
import { MERCHANT_TAB_CLEARANCE } from '../../../app/navigators/MerchantTabBar';
import type { MerchantSales } from '../../../data/types';
import type { MerchantStackParamList, MerchantTabParamList } from '../../../app/navigators/MerchantStack';
import type { EarningsPeriod } from '../../../data/types';
import { periodStart } from '../../../lib/period';
import { DaySection, dayLabel } from '../../../ui/DaySection';
import { groupByDay, bangkokDayKey } from '../../../lib/groupByDay';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MerchantTabParamList, 'MerchantSummary'>,
  NativeStackScreenProps<MerchantStackParamList>
>;

/** M1 + M5 สรุปยอดขายของร้าน */
export function MerchantSummaryScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data, isLoading } = useMerchantSummary();
  const [period, setPeriod] = useState<EarningsPeriod>('week');
  const { data: history = [], isLoading: ordersLoading } = useMerchantOrders('history');

  const todayKey = bangkokDayKey(new Date());
  const yesterdayKey = bangkokDayKey(new Date(Date.now() - 86_400_000));
  const dayLabels = { today: t('common.day.today'), yesterday: t('common.day.yesterday') };

  /**
   * ตัวเลขสรุปกับรายการข้างล่างมาจากชุดเดียวกัน ไม่งั้นบวกแล้วไม่ตรงกับหัว
   * นับเฉพาะใบที่ส่งถึงแล้ว ใบที่ถูกยกเลิกหรือยังอยู่กับไรเดอร์ยังไม่ใช่ยอดขายของร้าน (§6.1)
   */
  const inPeriod = useMemo(() => {
    const from = periodStart(period, new Date()).getTime();
    return history.filter(
      (o) => o.status === 'delivered' && new Date(o.createdAt).getTime() >= from,
    );
  }, [history, period]);

  const periodSales = useMemo(() => ({
    orders: inPeriod.length,
    foodSalesSatang: inPeriod.reduce((s, o) => s + o.foodTotal, 0),
    commissionSatang: inPeriod.reduce((s, o) => s + o.commission, 0),
    netSatang: inPeriod.reduce((s, o) => s + o.restaurantPayout, 0),
  }), [inPeriod]);

  return (
    <SafeAreaView
      testID="screen-merchant-summary"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: MERCHANT_TAB_CLEARANCE, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1">{t('merchant.summary.title')}</Text>

        {/* คิวมาก่อนเงินเสมอ ใบที่ยังไม่ได้ทำคือสิ่งที่ทำให้เสียลูกค้า ไม่ใช่ยอดเมื่อวาน */}
        <Card tone="teal">
          <View style={{ gap: p.space.xs }}>
            <Text variant="kicker" color="onTealMuted">{t('merchant.summary.openQueue')}</Text>
            <Text variant="h1" color="onTeal" testID="summary-queue">
              {data?.openQueue ?? 0}
            </Text>
            <Button
              testID="btn-go-queue"
              variant="secondary"
              label={t('merchant.summary.goQueue')}
              onPress={() => navigation.navigate('MerchantOrders')}
            />
          </View>
        </Card>

        {/* เลือกช่วงก่อน แล้วตัวเลขกับรายการข้างล่างเปลี่ยนตามชุดเดียวกัน */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ alignItems: 'center', gap: p.space.sm }}
        >
          {(['today', 'week', 'month'] as EarningsPeriod[]).map((key) => (
            <Chip
              key={key}
              testID={`sales-period-${key}`}
              label={t(`rider.earnings.period.${key}`)}
              active={key === period}
              onPress={() => setPeriod(key)}
            />
          ))}
        </ScrollView>

        {isLoading || ordersLoading ? (
          <SkeletonCards testID="summary-skeleton" count={2} photoHeight={0} />
        ) : (
          <>
            <SalesBlock
              testID="sales-period"
              title={t(`rider.earnings.period.${period}`)}
              sales={periodSales}
            />

            <Text variant="kicker" color="muted">{t('merchant.summary.breakdown')}</Text>

            {inPeriod.length === 0 ? (
              <Card>
                <Text testID="sales-empty" variant="body" color="muted">
                  {t('merchant.summary.emptyPeriod')}
                </Text>
              </Card>
            ) : (
              /* จับกลุ่มตามวัน ร้านจึงเห็นว่าวันไหนขายได้เท่าไหร่ ไม่ใช่รายการยาวเป็นพืด */
              groupByDay(inPeriod, (o) => o.createdAt, (o) => o.restaurantPayout).map((group) => (
                <View key={group.key} style={{ gap: p.space.sm }}>
                  <DaySection
                    testID={`sales-day-${group.key}`}
                    label={dayLabel(group.key, todayKey, yesterdayKey, dayLabels, i18n.language)}
                    total={formatBaht(group.total)}
                  />
                  {group.items.map((o) => (
                    <Pressable
                      key={o.id}
                      testID={`sales-order-${o.id}`}
                      onPress={() => navigation.navigate('MerchantOrderDetail', { orderId: o.id })}
                    >
                      <Card>
                        <View
                          style={{
                            flexDirection: 'row', alignItems: 'center',
                            justifyContent: 'space-between', gap: p.space.md,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text variant="small" bold numberOfLines={1}>{o.reference}</Text>
                            <Text variant="caption" color="muted" numberOfLines={1}>
                              {o.items.map((i) => `${i.quantity}× ${i.name}`).join(' · ')}
                            </Text>
                          </View>
                          <Text variant="small" bold>{formatBaht(o.restaurantPayout)}</Text>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              ))
            )}
          </>
        )}

        {/* เฟส 1 ยังไม่มีรอบโอนอัตโนมัติ (product-spec §2 §6.2) บอกตรง ๆ ว่ายังไม่มี */}
        <Card>
          <View style={{ gap: p.space.xs }}>
            <Text variant="kicker" color="muted">{t('merchant.summary.payoutTitle')}</Text>
            <Text variant="small" color="muted">{t('merchant.summary.payoutBody')}</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SalesBlock({
  title, sales, testID,
}: { title: string; sales?: MerchantSales; testID: string }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const s = sales ?? { orders: 0, foodSalesSatang: 0, commissionSatang: 0, netSatang: 0 };

  return (
    <Card testID={testID}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="kicker" color="muted">{title}</Text>
          <Text variant="kicker" color="muted">
            {t('merchant.summary.orders', { count: s.orders })}
          </Text>
        </View>

        <Row label={t('merchant.summary.foodSales')} value={formatBaht(s.foodSalesSatang)} />
        {/* ค่าธรรมเนียม 15% ของค่าอาหารเท่านั้น (§6.1) โชว์เป็นยอดติดลบให้เห็นว่าถูกหัก */}
        <Row
          label={t('merchant.summary.commission')}
          value={`−${formatBaht(s.commissionSatang)}`}
        />
        <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
        <Row label={t('merchant.summary.net')} value={formatBaht(s.netSatang)} strong />
      </View>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text variant={strong ? 'body' : 'small'} color={strong ? 'primary' : 'muted'} bold={strong}>
        {label}
      </Text>
      <Text variant={strong ? 'body' : 'small'} bold={strong}>{value}</Text>
    </View>
  );
}
