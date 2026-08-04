import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Badge, Card, IconChip } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { pickImage } from '../../../lib/media/pickImage';
import { useRiderDocuments, useUploadDocument } from '../hooks';
import type { RiderDocument, RiderDocumentKind } from '../../../data/types';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderDocuments'>;

/** เรียงตามลำดับที่คนกรอกจริง: ตัวตนก่อน แล้วค่อยรถ */
const KINDS: RiderDocumentKind[] = [
  'selfie', 'id_card_front', 'id_card_back', 'licence', 'vehicle_book', 'insurance',
];

const TONE: Record<RiderDocument['status'], 'brand' | 'teal' | 'neutral' | 'danger'> = {
  missing: 'neutral',
  reviewing: 'brand',
  verified: 'teal',
  rejected: 'danger',
};

/** R8 เอกสารของฉัน */
export function RiderDocumentsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: docs = [], isLoading } = useRiderDocuments();
  const upload = useUploadDocument();

  /** ชนิดที่กำลังอัปอยู่ ต้องรู้ทีละใบ ไม่ใช่ล็อกทั้งจอตอนอัปใบเดียว */
  const [busy, setBusy] = useState<RiderDocumentKind | null>(null);

  const byKind = new Map(docs.map((d) => [d.kind, d]));
  const done = docs.filter((d) => d.status === 'verified').length;

  async function choose(kind: RiderDocumentKind) {
    // ยกเลิกไม่ใช่ข้อผิดพลาด pickImage คืน null แล้วจบ ไม่ต้องขึ้นอะไรเลย
    const file = await pickImage();
    if (!file) return;

    setBusy(kind);
    upload.mutate({ kind, file }, { onSettled: () => setBusy(null) });
  }

  return (
    <SafeAreaView
      testID="screen-rider-documents"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.documents.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" color="muted">{t('rider.documents.subtitle')}</Text>

        <Text testID="documents-progress" variant="kicker" color="muted">
          {t('rider.documents.progress', { done, total: KINDS.length })}
        </Text>

        {upload.isError ? (
          <Text testID="documents-error" variant="small" color="danger">
            {(upload.error as Error).message}
          </Text>
        ) : null}

        {isLoading ? (
          <Text variant="body" color="muted">{t('common.loading')}</Text>
        ) : (
          KINDS.map((kind) => {
            const doc = byKind.get(kind)
              ?? { kind, status: 'missing' as const, rejectionReason: null, uploadedAt: null };
            const uploading = busy === kind;

            return (
              <Pressable
                key={kind}
                testID={`document-${kind}`}
                accessibilityRole="button"
                accessibilityLabel={t(`rider.documents.kind.${kind}`)}
                disabled={uploading}
                onPress={() => void choose(kind)}
              >
                <Card>
                  <View style={{ flexDirection: 'row', gap: p.space.md, alignItems: 'center' }}>
                    <IconChip
                      name={doc.status === 'verified' ? 'check' : 'edit'}
                      tone={doc.status === 'verified' ? 'teal' : 'neutral'}
                    />

                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text variant="body" bold numberOfLines={1}>
                        {t(`rider.documents.kind.${kind}`)}
                      </Text>
                      <Text variant="caption" color="muted">
                        {t(`rider.documents.hint.${kind}`)}
                      </Text>

                      {/* เหตุผลที่ไม่ผ่านอยู่ติดกับใบที่ไม่ผ่าน ไม่ใช่รวมไว้ข้างบน */}
                      {doc.status === 'rejected' && doc.rejectionReason ? (
                        <Text
                          testID={`document-reason-${kind}`}
                          variant="small"
                          color="danger"
                        >
                          {doc.rejectionReason}
                        </Text>
                      ) : null}
                    </View>

                    <Badge
                      label={uploading
                        ? t('rider.documents.uploading')
                        : t(`rider.documents.status.${doc.status}`)}
                      tone={uploading ? 'brand' : TONE[doc.status]}
                    />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
