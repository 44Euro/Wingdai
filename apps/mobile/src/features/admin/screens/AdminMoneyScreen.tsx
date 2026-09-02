import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import { ADMIN_TAB_CLEARANCE } from '../../../app/navigators/AdminTabBar';
import {
  useOpenRefunds, useRestaurantPayables, useSettleRestaurant, useRidersHoldingCash, useRiderPayouts,
} from '../hooks';
import { RefundCard } from '../components/RefundCard';
import { CashCard } from '../components/CashCard';
import { PayoutCard } from '../components/PayoutCard';
import type { RestaurantPayable } from '../../../data/types';
import { useMerchantPayouts, useDecideMerchantPayout } from '../hooks';

/** AD5 + AD7 รวมเป็นแท็บเดียว "วันนี้เงินไปไหนบ้าง" */
export function AdminMoneyScreen() {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: refunds = [] } = useOpenRefunds();
  const { data: payables = [] } = useRestaurantPayables();
  const { data: cashHolders = [] } = useRidersHoldingCash();
  const { data: payouts = [] } = useRiderPayouts();
  const { data: shopPayouts = [] } = useMerchantPayouts();
  const decideShopPayout = useDecideMerchantPayout();

  return (
    <SafeAreaView
      testID="screen-admin-money"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: ADMIN_TAB_CLEARANCE,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1">{t('admin.money.title')}</Text>

        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">{t('admin.refunds', { count: refunds.length })}</Text>
          {refunds.length === 0 ? (
            <Text testID="admin-no-refunds" variant="body" color="muted">
              {t('admin.noRefunds')}
            </Text>
          ) : (
            refunds.map((c) => <RefundCard key={c.id} refundCase={c} />)
          )}
        </View>

        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.cash.title')} ({cashHolders.length})
          </Text>
          {cashHolders.length === 0 ? (
            <Text testID="admin-no-cash" variant="body" color="muted">
              {t('admin.cash.empty')}
            </Text>
          ) : (
            cashHolders.map((h) => <CashCard key={h.accountId} holder={h} />)
          )}
        </View>

        {/* R12 วางไว้ต่อจากเงินสด เพราะสองก้อนนี้หักกัน (§6.2 เงินสดในมือหักจากยอดถอน) */}
        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.payouts.title')} ({payouts.length})
          </Text>
          {payouts.length === 0 ? (
            <Text testID="admin-no-payouts" variant="body" color="muted">
              {t('admin.payouts.empty')}
            </Text>
          ) : (
            payouts.map((r) => <PayoutCard key={r.id} payout={r} />)
          )}
        </View>

        {/* คำขอถอนของร้าน โครงเดียวกับของไรเดอร์ แต่คนละบัญชีในสมุดบัญชี (§6.2) */}
        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.shopPayouts.title')} ({shopPayouts.length})
          </Text>
          {shopPayouts.length === 0 ? (
            <Text testID="admin-no-shop-payouts" variant="body" color="muted">
              {t('admin.shopPayouts.empty')}
            </Text>
          ) : (
            shopPayouts.map((r) => (
              <Card key={r.id} testID={`shop-payout-${r.id}`}>
                <View style={{ gap: p.space.sm }}>
                  <View
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      justifyContent: 'space-between', gap: p.space.md,
                    }}
                  >
                    <Text variant="body" bold numberOfLines={1} style={{ flex: 1 }}>
                      {r.restaurantName}
                    </Text>
                    <Text variant="body" bold>{formatBaht(r.amountSatang)}</Text>
                  </View>
                  <Button
                    testID={`btn-approve-shop-payout-${r.id}`}
                    label={t('admin.shopPayouts.approve')}
                    disabled={decideShopPayout.isPending}
                    onPress={() =>
                      decideShopPayout.mutate({ payoutId: r.id, approve: true })}
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.payables.title')} ({payables.length})
          </Text>
          {payables.length === 0 ? (
            <Text testID="admin-no-payables" variant="body" color="muted">
              {t('admin.payables.empty')}
            </Text>
          ) : (
            payables.map((r) => <PayableCard key={r.restaurantId} payable={r} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** ยอดค้างจ่ายของร้านหนึ่ง (design AD7) */
function PayableCard({ payable }: { payable: RestaurantPayable }) {
  const { t, i18n } = useTranslation();
  const { primitives: p } = useTheme();
  const settle = useSettleRestaurant();

  return (
    <Card testID={`payable-${payable.restaurantId}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="h3" numberOfLines={1}>{payable.name}</Text>
            <Text variant="small" color="muted" numberOfLines={1}>{payable.ownerName}</Text>
          </View>
          <Text variant="h3">{formatBaht(payable.payableSatang)}</Text>
        </View>

        <Text variant="caption" color="muted">
          {t('admin.payables.orderCount', { count: payable.orderCount })}
        </Text>

        <Button
          testID={`btn-settle-${payable.restaurantId}`}
          label={t('admin.payables.settle', { amount: formatBaht(payable.payableSatang) })}
          disabled={settle.isPending}
          onPress={() => settle.mutate(payable.restaurantId)}
        />

        {settle.isError ? (
          <Text testID="payable-settle-error" variant="small" color="danger">
            {errorText(settle.error, t, i18n.language)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
