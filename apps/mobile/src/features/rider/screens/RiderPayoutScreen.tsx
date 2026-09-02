import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useRiderBalance, useRequestPayout } from '../hooks';
import { RIDER_TAB_CLEARANCE } from '../../../app/navigators/RiderTabBar';
import type { RiderStackParamList, RiderTabParamList } from '../../../app/navigators/RiderStack';
import { SkeletonCards } from '../../../ui/motion';

type Props = CompositeScreenProps<
  BottomTabScreenProps<RiderTabParamList, 'RiderPayout'>,
  NativeStackScreenProps<RiderStackParamList>
>;

/** R12 รายได้และการถอนเงิน */
export function RiderPayoutScreen() {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: balance, isLoading } = useRiderBalance();
  const requestPayout = useRequestPayout();

  const canWithdraw = (balance?.withdrawableSatang ?? 0) > 0 && !balance?.pending;

  return (
    <SafeAreaView
      testID="screen-rider-payout"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.payout.title')} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: RIDER_TAB_CLEARANCE,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading || !balance ? (
          <SkeletonCards testID="list-loading" count={3} photoHeight={0} />
        ) : (
          <>
            {/* ยอดใหญ่ตัวเดียวที่ไรเดอร์เปิดจอนี้มาหา */}
            <Card tone="teal">
              <View style={{ gap: p.space.xs }}>
                <Text variant="kicker" color="onTealMuted">
                  {t('rider.payout.available')}
                </Text>
                <Text variant="h1" color="onTeal" testID="payout-withdrawable">
                  {formatBaht(balance.withdrawableSatang)}
                </Text>
              </View>
            </Card>

            <Card>
              <View style={{ gap: p.space.md }}>
                <Row
                  testID="payout-payable"
                  label={t('rider.payout.earned')}
                  value={formatBaht(balance.payableSatang)}
                />

                {/* บรรทัดเงินสดโผล่เฉพาะตอนถืออยู่จริง ไรเดอร์ที่รับแต่พร้อมเพย์ */}
                {balance.cashHeldSatang > 0 ? (
                  <Row
                    testID="payout-cash-held"
                    label={t('rider.payout.cashHeld')}
                    value={`− ${formatBaht(balance.cashHeldSatang)}`}
                    hint={t('rider.payout.cashHeldHint')}
                  />
                ) : null}
              </View>
            </Card>

            {balance.pending ? (
              <Card>
                <Text testID="payout-pending" variant="body" color="muted">
                  {t('rider.payout.pending', {
                    amount: formatBaht(balance.pending.amountSatang),
                  })}
                </Text>
              </Card>
            ) : null}

            {canWithdraw ? (
              <Button
                testID="btn-request-payout"
                label={t('rider.payout.withdraw')}
                trailingLabel={formatBaht(balance.withdrawableSatang)}
                disabled={requestPayout.isPending}
                onPress={() => requestPayout.mutate(balance.withdrawableSatang)}
              />
            ) : balance.pending ? null : (
              <Text testID="payout-blocked" variant="small" color="muted">
                {t('rider.payout.needMore', {
                  amount: formatBaht(-balance.withdrawableSatang),
                })}
              </Text>
            )}

            {requestPayout.isError ? (
              <Text testID="payout-error" variant="small" color="danger">
                {errorText(requestPayout.error, t, i18n.language)}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  hint,
  testID,
}: {
  label: string;
  value: string;
  hint?: string;
  testID: string;
}) {
  const { primitives: p } = useTheme();
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.md }}>
        <Text variant="body" color="muted" style={{ flex: 1 }}>{label}</Text>
        <Text variant="body" bold testID={testID}>{value}</Text>
      </View>
      {hint ? <Text variant="caption" color="faint">{hint}</Text> : null}
    </View>
  );
}
