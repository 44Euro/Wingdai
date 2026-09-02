import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, IconChip } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useRiderStatus, useAdvanceJob } from '../hooks';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderJob'>;

/** R2 งานที่กำลังทำ: ไปรับที่ไหน ส่งที่ไหน ต้องเก็บเงินไหม */
export function RiderJobScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: status } = useRiderStatus();
  const advance = useAdvanceJob();
  const job = status?.activeJobs.find((j) => j.orderId === route.params.orderId);

  if (!job) {
    return (
      <SafeAreaView
        testID="screen-rider-job"
        edges={['top']}
        style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      >
        <ScreenHeader title={t('rider.job.title')} onBack={() => navigation.goBack()} />
        <View style={{ padding: p.space.screen }}>
          <Text testID="job-missing" variant="body" color="muted">{t('rider.job.missing')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  /** ปุ่มถัดไปตามสถานะ ตรงกับที่เซิร์ฟเวอร์ยอมให้ไรเดอร์ทำ (orders/authorize.ts) */
  const next =
    job.status === 'preparing' ? ('picked_up' as const)
      : job.status === 'picked_up' ? ('delivered' as const)
        : null;

  return (
    <SafeAreaView
      testID="screen-rider-job"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={job.reference} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ gap: p.space.lg }}>
            <Stop
              icon="store"
              kicker={t('rider.job.pickup')}
              title={job.restaurantName}
              detail={job.restaurantAddress}
            />
            <Stop
              icon="mapPin"
              kicker={t('rider.job.dropoff')}
              title={job.dropoffAddress}
              detail={job.dropoffNote ?? undefined}
            />
          </View>
        </Card>

        <Card>
          <View style={{ gap: p.space.sm }}>
            <Text variant="kicker" color="muted">{t('rider.job.items')}</Text>
            {job.items.map((i, idx) => (
              <Text key={`${i.name}-${idx}`} variant="body">
                {i.quantity}× {i.name}
              </Text>
            ))}
          </View>
        </Card>

        <Card>
          <View style={{ gap: p.space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color="muted">{t('rider.job.pay')}</Text>
              <Text variant="body" bold>{formatBaht(job.riderPaySatang)}</Text>
            </View>
            {/* §6.5 §6.2 ลูกค้าเปลี่ยนไปจ่ายพร้อมเพย์กลางทางได้ พอเปลี่ยนแล้ว */}
            {job.collectCashSatang > 0 ? (
              <View
                testID="job-collect-cash"
                style={{
                  backgroundColor: tokens.brandTint,
                  borderRadius: p.radius.md,
                  padding: p.space.md,
                }}
              >
                <Text variant="small" color="onBrandTint" bold>
                  {t('rider.job.collectCash', { amount: formatBaht(job.collectCashSatang) })}
                </Text>
              </View>
            ) : (
              <Text testID="job-already-paid" variant="small" color="success">
                {t('rider.job.alreadyPaid')}
              </Text>
            )}
          </View>
        </Card>

        {next ? (
          <Button
            testID="btn-job-next"
            label={t(`rider.job.action.${next}`)}
            disabled={advance.isPending}
            onPress={() => {
              /** ทั้งสองขั้นมีจอของตัวเอง ปุ่มนี้จึงเป็นแค่ทางเข้า ไม่ใช่ที่เปลี่ยนสถานะ */
              navigation.navigate(
                next === 'delivered' ? 'RiderProof' : 'RiderPickup',
                { orderId: job.orderId },
              );
            }}
          />
        ) : (
          <Text testID="job-waiting-kitchen" variant="small" color="muted">
            {t('rider.job.waitingKitchen')}
          </Text>
        )}

        {advance.isError ? (
          <Text testID="job-action-error" variant="small" color="danger">
            {errorText(advance.error, t, i18n.language)}
          </Text>
        ) : null}

        {/* แชทกับลูกค้า (คู่ของ C10) ไรเดอร์ที่หาบ้านไม่เจอต้องถามได้ทันที */}
        <Button
          testID="btn-chat-customer"
          label={t('chat.withCustomer')}
          variant="secondary"
          onPress={() => navigation.navigate('RiderChat', { orderId: job.orderId })}
        />

        {/* R9 ทางออกเมื่อไปต่อไม่ได้ อยู่ทุกจอที่ไรเดอร์ยังถืองานอยู่ */}
        <Button
          testID="btn-report-issue"
          label={t('rider.issue.title')}
          variant="secondary"
          onPress={() => navigation.navigate('RiderIssue', { orderId: job.orderId })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stop({
  icon,
  kicker,
  title,
  detail,
}: {
  icon: 'store' | 'mapPin';
  kicker: string;
  title: string;
  detail?: string;
}) {
  const { primitives: p } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: p.space.md }}>
      <IconChip name={icon} tone={icon === 'store' ? 'brand' : 'teal'} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="kicker" color="muted">{kicker}</Text>
        <Text variant="body" bold>{title}</Text>
        {detail ? (
          <Text variant="small" color="muted">{detail}</Text>
        ) : null}
      </View>
    </View>
  );
}
