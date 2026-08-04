import React, { useState } from 'react';
import { View, ScrollView, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { PressScale } from '../../../ui/motion';
import { useReportIssue } from '../hooks';
import type { RiderIssueKind } from '../../../data/types';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderIssue'>;

/** เรียงจากที่เจอบ่อยสุดไปหาที่ร้ายแรงสุด ปุ่มอุบัติเหตุอยู่ล่างสุด กดพลาดยาก */
const KINDS: RiderIssueKind[] = ['cannot_reach_customer', 'bad_address', 'accident'];

/** R9 แจ้งปัญหาระหว่างส่ง */
export function RiderIssueScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const report = useReportIssue();

  const [kind, setKind] = useState<RiderIssueKind | null>(null);
  const [detail, setDetail] = useState('');
  const [sent, setSent] = useState(false);

  const hotline = t('rider.issue.hotlineNumber');

  return (
    <SafeAreaView
      testID="screen-rider-issue"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.issue.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* เบอร์อยู่ใน i18n ไม่ฮาร์ดโค้ดในจอ เปลี่ยนเบอร์แล้วต้องแก้ที่เดียว */}
        <Button
          testID="btn-call-hotline"
          label={t('rider.issue.callHotline', { number: hotline })}
          onPress={() => Linking.openURL(`tel:${hotline.replace(/[^0-9+]/g, '')}`)}
        />

        <Text variant="small" color="muted">{t('rider.issue.subtitle')}</Text>

        <View style={{ gap: p.space.sm }}>
          {KINDS.map((k) => {
            const on = kind === k;
            return (
              <PressScale
                key={k}
                testID={`issue-${k}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(`rider.issue.kind.${k}`)}
                onPress={() => setKind(k)}
              >
                <Card
                  style={on ? { borderWidth: 2, borderColor: tokens.brandAccent } : undefined}
                >
                  <View style={{ gap: 2 }}>
                    <Text variant="body" bold>{t(`rider.issue.kind.${k}`)}</Text>
                    <Text variant="small" color="muted">{t(`rider.issue.hint.${k}`)}</Text>
                  </View>
                </Card>
              </PressScale>
            );
          })}
        </View>

        <View style={{ gap: p.space.sm }}>
          <Text variant="kicker" color="muted">{t('rider.issue.detailLabel')}</Text>
          <TextInput
            testID="issue-detail"
            value={detail}
            onChangeText={setDetail}
            placeholder={t('rider.issue.detailPlaceholder')}
            placeholderTextColor={tokens.textFaint}
            multiline
            maxLength={500}
            allowFontScaling={false}
            style={{
              minHeight: 96,
              textAlignVertical: 'top',
              padding: p.space.md,
              fontSize: 15,
              color: tokens.textPrimary,
              backgroundColor: tokens.bgRaised,
              borderRadius: p.radius.lg,
            }}
          />
        </View>

        {report.isError ? (
          <Text testID="issue-error" variant="small" color="danger">
            {(report.error as Error).message}
          </Text>
        ) : null}

        {sent ? (
          /** บอกตรง ๆ ว่า "แจ้งแล้ว แต่ยังต้องส่งของต่อ" ถ้าเขียนแค่ "ส่งเรื่องแล้ว" */
          <Card tone="teal">
            <Text testID="issue-sent" variant="body" color="onTeal">
              {t('rider.issue.sent')}
            </Text>
          </Card>
        ) : (
          <Button
            testID="btn-send-issue"
            label={t('rider.issue.send')}
            disabled={kind === null || report.isPending}
            onPress={() => {
              if (!kind) return;
              report.mutate(
                { orderId, kind, ...(detail.trim() ? { detail: detail.trim() } : {}) },
                { onSuccess: () => setSent(true) },
              );
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
