import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Badge, Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import { useDecideRefund } from '../hooks';
import type { RefundCase } from '../../../data/types';

/** §6.4 ต้องโชว์ "ข้อเสนอพร้อมเหตุผล" ไม่ใช่ปุ่มคืนเงินเปล่า ๆ */
export function RefundCard({ refundCase }: { refundCase: RefundCase }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const decide = useDecideRefund();

  const canOneTap = refundCase.suggestedAmountSatang !== null && refundCase.fault !== null;

  return (
    <Card testID={`refund-${refundCase.id}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="h3">{refundCase.reference ?? refundCase.orderId.slice(0, 8)}</Text>
            <Text variant="small" color="muted">{refundCase.customerReason}</Text>
          </View>
          {refundCase.fault ? (
            <Badge label={t(`admin.fault.${refundCase.fault}`)} tone="teal" />
          ) : null}
        </View>

        <View style={{ gap: 2 }}>
          {refundCase.reasoning.map((line, i) => (
            <Text key={i} variant="small" color="muted">• {line}</Text>
          ))}
        </View>

        {canOneTap ? (
          <Text testID={`refund-suggested-${refundCase.id}`} variant="body" bold>
            {t('admin.suggestedRefund', {
              amount: formatBaht(refundCase.suggestedAmountSatang!),
            })}
          </Text>
        ) : (
          /** ระบบไม่เสนอยอด = แอดมินต้องตัดสินเอง ไม่ใช่มีเลขให้กดตามโดยไม่คิด */
          <Text testID={`refund-needs-review-${refundCase.id}`} variant="small" color="danger">
            {t('admin.needsReview')}
          </Text>
        )}

        <View style={{ gap: p.space.sm }}>
          <Button
            testID={`btn-approve-${refundCase.id}`}
            label={t('admin.approve')}
            disabled={decide.isPending || !canOneTap}
            onPress={() => decide.mutate({ caseId: refundCase.id, approve: true })}
          />
          <Button
            testID={`btn-reject-${refundCase.id}`}
            variant="secondary"
            label={t('admin.reject')}
            disabled={decide.isPending}
            onPress={() => decide.mutate({ caseId: refundCase.id, approve: false })}
          />
        </View>

        {decide.isError ? (
          <Text testID="refund-decide-error" variant="small" color="danger">
            {(decide.error as Error).message}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
