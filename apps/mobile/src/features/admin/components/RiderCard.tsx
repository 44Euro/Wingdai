import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { useDecideRider } from '../hooks';
import type { PendingRider } from '../../../data/types';

/** ใบสมัครไรเดอร์ที่รอตรวจ (product-spec §7) */
export function RiderCard({
  rider,
  onOpenDocuments,
}: {
  rider: PendingRider;
  onOpenDocuments: (accountId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { primitives: p } = useTheme();
  const decide = useDecideRider();
  const [reason, setReason] = useState('');

  return (
    <Card testID={`pending-rider-${rider.accountId}`}>
      <View style={{ gap: p.space.sm }}>
        <View>
          <Text variant="h3">{rider.fullName}</Text>
          <Text variant="small" color="muted">{rider.phone}</Text>
          <Text variant="small" color="muted">
            {rider.vehicleRegistration}
            {rider.zoneName ? ` · ${rider.zoneName}` : ''}
          </Text>
        </View>

        <Text variant="caption" color="muted">
          {t('admin.riders.licenceExpiry')} {rider.licenceExpiry}
          {' · '}
          {t('admin.riders.insuranceExpiry')} {rider.compulsoryInsuranceExpiry}
        </Text>

        <Text variant="caption" color="muted">
          {rider.bankName} · {rider.bankAccountNumber} · {rider.bankAccountName}
        </Text>

        {!rider.bankNameMatches ? (
          <Text testID={`bank-mismatch-${rider.accountId}`} variant="small" color="danger" bold>
            {t('admin.riders.bankMismatch')}
          </Text>
        ) : null}

        {/* AD6 ต้องเห็นรูปก่อนกดผ่าน ไม่ใช่อนุมัติจากข้อมูลที่พิมพ์มาอย่างเดียว */}
        <Button
          testID={`btn-view-docs-${rider.accountId}`}
          variant="secondary"
          label={t('admin.riders.viewDocuments')}
          onPress={() => onOpenDocuments(rider.accountId)}
        />

        <Button
          testID={`btn-approve-rider-${rider.accountId}`}
          label={t('admin.riders.approve')}
          disabled={decide.isPending}
          onPress={() => decide.mutate({ accountId: rider.accountId, approve: true })}
        />

        {/* ปฏิเสธต้องมีเหตุผล ไม่งั้นไรเดอร์ไม่รู้ว่าต้องแก้อะไรแล้วส่งใหม่ */}
        <Field label={t('admin.riders.rejectReason')}>
          <Input
            testID={`input-reject-reason-${rider.accountId}`}
            accessibilityLabel={t('admin.riders.rejectReason')}
            value={reason}
            onChangeText={setReason}
          />
        </Field>
        <Button
          testID={`btn-reject-rider-${rider.accountId}`}
          variant="secondary"
          label={t('admin.riders.reject')}
          disabled={decide.isPending || reason.trim() === ''}
          onPress={() =>
            decide.mutate({ accountId: rider.accountId, approve: false, rejectionReason: reason })}
        />

        {decide.isError ? (
          <Text testID="rider-decide-error" variant="small" color="danger">
            {errorText(decide.error, t, i18n.language)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
