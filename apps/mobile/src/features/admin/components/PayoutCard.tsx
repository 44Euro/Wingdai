import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { formatBaht, relativeTime } from '../../../lib/format';
import { useDecideRiderPayout } from '../hooks';
import type { PendingRiderPayout } from '../../../data/types';

/** คำขอถอนเงินหนึ่งใบ (design R12 product-spec §10 "ไรเดอร์ขอ แอดมินยืนยัน") */
export function PayoutCard({ payout }: { payout: PendingRiderPayout }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const decide = useDecideRiderPayout();
  const [reason, setReason] = useState('');

  const waited = relativeTime(payout.requestedAt);

  return (
    <Card testID={`payout-${payout.id}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="h3" numberOfLines={1}>{payout.fullName}</Text>
            <Text variant="small" color="muted">{payout.phone}</Text>
          </View>
          <Text variant="h3">{formatBaht(payout.amountSatang)}</Text>
        </View>

        <Text variant="caption" color="muted">
          {t('admin.payouts.requested', { when: t(waited.key, { count: waited.count }) })}
        </Text>

        <Button
          testID={`btn-approve-payout-${payout.id}`}
          label={t('admin.payouts.approve', { amount: formatBaht(payout.amountSatang) })}
          disabled={decide.isPending}
          onPress={() => decide.mutate({ payoutId: payout.id, approve: true })}
        />

        {/* ปฏิเสธต้องมีเหตุผล ไรเดอร์ต้องรู้ว่าทำไมเงินไม่ออก ไม่ใช่เห็นคำขอหายไปเฉย ๆ */}
        <Field label={t('admin.payouts.rejectReason')}>
          <Input
            testID={`input-payout-reason-${payout.id}`}
            accessibilityLabel={t('admin.payouts.rejectReason')}
            value={reason}
            onChangeText={setReason}
          />
        </Field>
        <Button
          testID={`btn-reject-payout-${payout.id}`}
          variant="secondary"
          label={t('admin.payouts.reject')}
          disabled={decide.isPending || reason.trim() === ''}
          onPress={() => decide.mutate({
            payoutId: payout.id, approve: false, rejectionReason: reason,
          })}
        />

        {/* เซิร์ฟเวอร์ตรวจยอดซ้ำตอนกดยืนยัน (§6.2) ไรเดอร์อาจรับงานเงินสดเพิ่มระหว่างที่ */}
        {decide.isError ? (
          <Text testID={`payout-error-${payout.id}`} variant="small" color="danger">
            {(decide.error as Error).message}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
