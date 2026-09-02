import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import { useSettleRiderCash } from '../hooks';
import type { RiderCashHolder } from '../../../data/types';

/** ไรเดอร์ที่ถือเงินสดของบริษัทอยู่ (product-spec §6.2) */
export function CashCard({ holder }: { holder: RiderCashHolder }) {
  const { t, i18n } = useTranslation();
  const { primitives: p } = useTheme();
  const settle = useSettleRiderCash();

  return (
    <Card testID={`rider-cash-${holder.accountId}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="h3" numberOfLines={1}>{holder.fullName}</Text>
            <Text variant="small" color="muted">{holder.phone}</Text>
          </View>
          <Text variant="h3" color={holder.atLimit ? 'danger' : 'primary'}>
            {formatBaht(holder.cashHeldSatang)}
          </Text>
        </View>

        {/* ชนเพดานแล้วระบบหยุดเสนองานเงินสด แอดมินต้องรู้ว่าทำไมไรเดอร์คนนี้งานหาย */}
        {holder.atLimit ? (
          <Text testID={`cash-at-limit-${holder.accountId}`} variant="small" color="danger" bold>
            {t('admin.cash.atLimit', { limit: formatBaht(holder.cashLimitSatang) })}
          </Text>
        ) : null}

        <Button
          testID={`btn-settle-cash-${holder.accountId}`}
          label={t('admin.cash.settleAll', { amount: formatBaht(holder.cashHeldSatang) })}
          disabled={settle.isPending}
          onPress={() =>
            settle.mutate({ accountId: holder.accountId, amountSatang: holder.cashHeldSatang })}
        />

        {settle.isError ? (
          <Text testID="cash-settle-error" variant="small" color="danger">
            {errorText(settle.error, t, i18n.language)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
