import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Badge, Card } from '../../../ui/Surface';
import { useForceDispatch, useResolveRiderIssue } from '../hooks';
import type { OrderException } from '../../../data/types';

export function ExceptionCard({ exception }: { exception: OrderException }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const force = useForceDispatch();
  const resolve = useResolveRiderIssue();

  return (
    <Card testID={`exception-${exception.orderId}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="h3">{exception.reference}</Text>
            <Text variant="small" color="muted">{exception.restaurantName}</Text>
          </View>
          <Badge label={t(`admin.kind.${exception.kind}`)} tone="brand" />
        </View>

        {/* บอกว่าต้องทำอะไร ไม่ใช่แค่ว่ามีอะไรผิด */}
        <Text variant="small" color="danger">{exception.detail}</Text>

        {exception.kind === 'no_rider' ? (
          <Button
            testID={`btn-force-dispatch-${exception.orderId}`}
            variant="secondary"
            label={t('admin.forceDispatch')}
            disabled={force.isPending}
            onPress={() => force.mutate(exception.orderId)}
          />
        ) : null}

        {/* R9 เคลียร์เรื่องที่ไรเดอร์แจ้งแล้วจัดการเสร็จ */}
        {exception.riderIssueId ? (
          <Button
            testID={`btn-resolve-issue-${exception.orderId}`}
            variant="secondary"
            label={t('admin.resolveIssue')}
            disabled={resolve.isPending}
            onPress={() => resolve.mutate(exception.riderIssueId!)}
          />
        ) : null}

        {force.data && !force.data.offered ? (
          <Text testID="force-dispatch-result" variant="small" color="muted">
            {force.data.reason}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
