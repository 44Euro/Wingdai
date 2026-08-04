import React, { useState } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Badge, Card } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import type { AdminStackParamList } from '../../../app/navigators/AdminStack';
import { useRiderDocuments, useDecideRiderDocument } from '../hooks';
import type { RiderDocumentWithUrl } from '../../../data/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminRiderDocs'>;

/** AD6 ตรวจเอกสาร KYC ทีละใบ พร้อมเห็นรูปจริง */
export function AdminRiderDocsScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { accountId, name } = route.params;
  const { data: docs = [], isLoading } = useRiderDocuments(accountId);

  return (
    <SafeAreaView
      testID="screen-admin-rider-docs"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={name} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: p.space.screen, gap: p.space.md }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" color="muted">{t('admin.docs.subtitle')}</Text>
        {isLoading
          ? null
          : docs.map((d) => <DocumentCard key={d.kind} accountId={accountId} doc={d} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

/** สีสถานะต้องตรงกับที่ไรเดอร์เห็นบนจอ R8 เป๊ะ ไรเดอร์กับแอดมินคุยกันเรื่องเอกสารใบเดียวกัน */
const TONE: Record<RiderDocumentWithUrl['status'], 'brand' | 'teal' | 'neutral' | 'danger'> = {
  missing: 'neutral',
  reviewing: 'brand',
  verified: 'teal',
  rejected: 'danger',
};

function DocumentCard({ accountId, doc }: { accountId: string; doc: RiderDocumentWithUrl }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const decide = useDecideRiderDocument();
  const [reason, setReason] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Card testID={`admin-doc-${doc.kind}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
          <Text variant="h3" style={{ flex: 1 }}>{t(`rider.documents.kind.${doc.kind}`)}</Text>
          <Badge label={t(`rider.documents.status.${doc.status}`)} tone={TONE[doc.status]} />
        </View>

        {doc.url && !imageFailed ? (
          <Image
            testID={`admin-doc-image-${doc.kind}`}
            source={{ uri: doc.url }}
            onError={() => setImageFailed(true)}
            style={{
              width: '100%',
              aspectRatio: 3 / 2,
              borderRadius: p.radius.md,
              backgroundColor: tokens.bgSunken,
            }}
            resizeMode="cover"
          />
        ) : (
          /** รูปโหลดไม่ขึ้น (ลิงก์หมดอายุ/เน็ตหลุด) ต้องบอกว่าโหลดไม่ขึ้น */
          <View
            testID={`admin-doc-placeholder-${doc.kind}`}
            style={{
              width: '100%',
              aspectRatio: 3 / 2,
              borderRadius: p.radius.md,
              backgroundColor: tokens.bgSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="small" color="muted">
              {doc.status === 'missing' ? t('admin.docs.notSubmitted') : t('admin.docs.imageFailed')}
            </Text>
          </View>
        )}

        {doc.rejectionReason ? (
          <Text testID={`admin-doc-reason-${doc.kind}`} variant="small" color="danger">
            {doc.rejectionReason}
          </Text>
        ) : null}

        {doc.status === 'missing' ? null : (
          <>
            <Button
              testID={`btn-verify-${doc.kind}`}
              label={t('admin.docs.verify')}
              disabled={decide.isPending || doc.status === 'verified'}
              onPress={() => decide.mutate({ accountId, kind: doc.kind, approve: true })}
            />

            {/* ปฏิเสธต้องมีเหตุผล กฎเดียวกับคิวอนุมัติไรเดอร์ */}
            <Field label={t('admin.riders.rejectReason')}>
              <Input
                testID={`input-doc-reason-${doc.kind}`}
                accessibilityLabel={t('admin.riders.rejectReason')}
                value={reason}
                onChangeText={setReason}
              />
            </Field>
            <Button
              testID={`btn-reject-doc-${doc.kind}`}
              variant="secondary"
              label={t('admin.docs.reject')}
              disabled={decide.isPending || reason.trim() === ''}
              onPress={() => decide.mutate({
                accountId, kind: doc.kind, approve: false, rejectionReason: reason,
              })}
            />
          </>
        )}
      </View>
    </Card>
  );
}
