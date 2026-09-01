import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import { useMerchantSummary } from '../hooks';
import { MERCHANT_TAB_CLEARANCE } from '../../../app/navigators/MerchantTabBar';
import type { MerchantSales } from '../../../data/types';
import type { MerchantStackParamList, MerchantTabParamList } from '../../../app/navigators/MerchantStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MerchantTabParamList, 'MerchantSummary'>,
  NativeStackScreenProps<MerchantStackParamList>
>;

/** M1 + M5 สรุปยอดขายของร้าน */
export function MerchantSummaryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data, isLoading } = useMerchantSummary();

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

        {isLoading ? (
          <Text variant="body" color="muted">{t('common.loading')}</Text>
        ) : (
          <>
            <SalesBlock
              testID="sales-today"
              title={t('merchant.summary.today')}
              sales={data?.today}
            />
            <SalesBlock
              testID="sales-week"
              title={t('merchant.summary.last7Days')}
              sales={data?.last7Days}
            />
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
