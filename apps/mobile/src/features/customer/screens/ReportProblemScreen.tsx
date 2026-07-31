import React, { useState } from 'react';
import { View, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { repos } from '../../../data';
import type { RefundCase, RefundReason } from '../../../data/types';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'ReportProblem'>;

const REASONS: RefundReason[] = [
  'wrong_item', 'missing_item', 'food_quality', 'damaged', 'not_delivered', 'late', 'other',
];

/** ลูกค้าแจ้งปัญหาออร์เดอร์ (product-spec §6.4) */
export function ReportProblemScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const [reason, setReason] = useState<RefundReason | null>(null);
  const [detail, setDetail] = useState('');

  const submit = useMutation<RefundCase, Error>({
    mutationFn: () =>
      repos.refunds.open({
        orderId: route.params.orderId,
        reason: reason!,
        detail: detail.trim(),
        hasPhoto: false,
      }),
  });

  const ready = reason !== null && detail.trim().length > 0;

  return (
    <SafeAreaView
      testID="screen-report-problem"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('customer.report.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {submit.isSuccess ? (
          <Card testID="report-sent">
            <View style={{ gap: p.space.sm }}>
              <Text variant="h3">{t('customer.report.sentTitle')}</Text>
              {/* บอกตรง ๆ ว่ามีคนตรวจก่อน ไม่ใช่ทำให้เข้าใจว่าเงินกำลังจะเข้า */}
              <Text variant="body" color="muted">{t('customer.report.sentBody')}</Text>
              <Button
                testID="btn-report-done"
                label={t('common.back')}
                onPress={() => navigation.goBack()}
              />
            </View>
          </Card>
        ) : (
          <>
            <View style={{ gap: p.space.sm }}>
              <Text variant="kicker" color="muted">{t('customer.report.reason')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
                {REASONS.map((r) => (
                  <Chip
                    key={r}
                    testID={`reason-${r}`}
                    label={t(`customer.report.reasons.${r}`)}
                    active={r === reason}
                    onPress={() => setReason(r)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: p.space.sm }}>
              <Text variant="kicker" color="muted">{t('customer.report.detail')}</Text>
              <TextInput
                testID="input-report-detail"
                value={detail}
                onChangeText={setDetail}
                multiline
                maxLength={500}
                placeholder={t('customer.report.detailPlaceholder')}
                placeholderTextColor={tokens.textFaint}
                allowFontScaling={false}
                style={{
                  backgroundColor: tokens.bgRaised,
                  borderRadius: p.radius.lg,
                  borderWidth: 1.6,
                  borderColor: tokens.borderSubtle,
                  padding: p.space.md,
                  minHeight: 110,
                  textAlignVertical: 'top',
                  color: tokens.textPrimary,
                  fontSize: 15,
                }}
              />
            </View>

            <Button
              testID="btn-report-submit"
              label={t('customer.report.submit')}
              disabled={!ready || submit.isPending}
              onPress={() => submit.mutate()}
            />

            {submit.isError ? (
              <Text testID="report-error" variant="small" color="danger">
                {submit.error.message}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
