import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Field';
import { Card, Badge } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useMerchantPayout, useMerchantPayoutHistory, useRequestMerchantPayout } from '../hooks';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'MerchantPayout'>;

const TONE: Record<string, 'brand' | 'teal' | 'neutral'> = {
  requested: 'brand',
  paid: 'teal',
  rejected: 'neutral',
};

/**
 * ร้านขอถอนยอดค้างจ่าย ทีมงานเป็นคนอนุมัติ เงินถึงจะขยับ (product-spec §6.2)
 * §2 วางรอบโอนอัตโนมัติไว้เฟส 2 จอนี้คือฉบับที่มีคนกด แต่ลงบัญชีแบบเดียวกัน
 */
export function MerchantPayoutScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { restaurantId } = route.params;

  const { data: balance, isLoading } = useMerchantPayout(restaurantId);
  const { data: history = [] } = useMerchantPayoutHistory(restaurantId);
  const request = useRequestMerchantPayout(restaurantId);
  const [amount, setAmount] = useState('');

  const satang = Math.round(Number(amount.replace(/[^0-9.]/g, '')) * 100);
  const available = balance?.withdrawableSatang ?? 0;
  const canSubmit = Number.isFinite(satang) && satang > 0 && satang <= available
    && !balance?.pending && !request.isPending;

  return (
    <SafeAreaView
      testID="screen-merchant-payout"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('merchant.payout.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: p.space.screen, paddingTop: 0, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Card tone="teal">
          <View style={{ gap: p.space.xs }}>
            <Text variant="kicker" color="onTealMuted">{t('merchant.payout.available')}</Text>
            <Text testID="payout-available" variant="h1" color="onTeal">
              {formatBaht(available)}
            </Text>
            <Text variant="caption" color="onTealMuted">{t('merchant.payout.hint')}</Text>
          </View>
        </Card>

        {balance?.pending ? (
          /* มีใบค้างอยู่ กดขอใหม่ไม่ได้ บอกไปตรง ๆ ดีกว่าปล่อยให้กดแล้วเด้ง error */
          <Card testID="payout-pending">
            <View style={{ gap: p.space.xs }}>
              <Text variant="kicker" color="muted">{t('merchant.payout.pendingTitle')}</Text>
              <Text variant="h3">{formatBaht(balance.pending.amountSatang)}</Text>
              <Text variant="small" color="muted">{t('merchant.payout.pendingBody')}</Text>
            </View>
          </Card>
        ) : (
          <View style={{ gap: p.space.sm }}>
            <Text variant="kicker" color="muted">{t('merchant.payout.amountLabel')}</Text>
            <Input
              testID="input-payout-amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              keyboardType="decimal-pad"
              editable={!isLoading && available > 0}
            />
            {request.isError ? (
              <Text testID="payout-error" variant="small" color="danger">
                {(request.error as Error).message}
              </Text>
            ) : null}
            <Button
              testID="btn-request-payout"
              label={t('merchant.payout.submit')}
              disabled={!canSubmit}
              onPress={() => request.mutate(satang, { onSuccess: () => setAmount('') })}
            />
          </View>
        )}

        <Text variant="kicker" color="muted">{t('merchant.payout.historyTitle')}</Text>
        {history.length === 0 ? (
          <Text testID="payout-empty" variant="body" color="muted">
            {t('merchant.payout.empty')}
          </Text>
        ) : (
          history.map((row) => (
            <Card key={row.id} testID={`payout-row-${row.id}`}>
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between', gap: p.space.md,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="body" bold>{formatBaht(row.amountSatang)}</Text>
                  <Text variant="caption" color="muted">
                    {new Date(row.requestedAt).toLocaleDateString()}
                  </Text>
                  {row.rejectionReason ? (
                    <Text variant="caption" color="danger">{row.rejectionReason}</Text>
                  ) : null}
                </View>
                <Badge
                  label={t(`merchant.payout.status.${row.status}`)}
                  tone={TONE[row.status] ?? 'neutral'}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
