import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import type { AdminMetrics } from '../../../data/types';

/** ตัวเลข §8 ย้อนหลัง ค่าที่ยังวัดไม่ได้ซ่อนไปทั้งแถว ไม่แสดงเป็น 0 หรือขีด */
export function MetricsCard({ metrics, full }: { metrics: AdminMetrics; full?: boolean }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();

  const pct = (v: number | null) => (v === null ? null : `${(v * 100).toFixed(1)}%`);

  const rows: { label: string; value: string | null; bad: boolean }[] = [
    {
      label: t('admin.metric.ordersPerRiderHour'),
      value: metrics.ordersPerRiderHour?.toFixed(2) ?? null,
      bad: metrics.ordersPerRiderHour !== null && metrics.ordersPerRiderHour < 3,
    },
    {
      label: t('admin.metric.acceptRate'),
      value: pct(metrics.restaurantAcceptRate),
      bad: metrics.restaurantAcceptRate !== null && metrics.restaurantAcceptRate < 0.95,
    },
    {
      label: t('admin.metric.refundRate'),
      value: pct(metrics.refundRate),
      // §8 เกิน 2% = มีอะไรพังเชิงระบบ ไม่ใช่ความผันผวนปกติ
      bad: metrics.refundRate !== null && metrics.refundRate > 0.02,
    },
    {
      label: t('admin.metric.autoDispatchRate'),
      value: pct(metrics.autoDispatchRate),
      bad: metrics.autoDispatchRate !== null && metrics.autoDispatchRate < 0.9,
    },
    ...(full ? ([
      {
        label: t('admin.metric.contributionPerOrder'),
        value: metrics.contributionPerOrderSatang === null
          ? null
          : formatBaht(metrics.contributionPerOrderSatang),
        // §8 ต้อง > ฿0 ตั้งแต่วันแรก ติดลบคือออร์เดอร์ที่ยิ่งขายยิ่งขาดทุน
        bad: metrics.contributionPerOrderSatang !== null && metrics.contributionPerOrderSatang <= 0,
      },
      {
        label: t('admin.metric.medianDelivery'),
        value: metrics.medianDeliveryMinutes === null
          ? null
          : t('admin.live.minutes', { count: metrics.medianDeliveryMinutes }),
        bad: metrics.medianDeliveryMinutes !== null && metrics.medianDeliveryMinutes > 30,
      },
      {
        label: t('admin.metric.onTimeRate'),
        value: pct(metrics.onTimeRate),
        bad: metrics.onTimeRate !== null && metrics.onTimeRate < 0.9,
      },
      {
        label: t('admin.metric.promptPayRate'),
        value: pct(metrics.promptPayRate),
        // §8 > 80% ต่ำกว่านี้แปลว่ามาร์จิ้นโดนค่าธรรมเนียมกินมากกว่าที่วางแผนไว้
        bad: metrics.promptPayRate !== null && metrics.promptPayRate < 0.8,
      },
      {
        label: t('admin.metric.repeatOrderRate'),
        value: pct(metrics.repeatOrderRate),
        bad: metrics.repeatOrderRate !== null && metrics.repeatOrderRate < 0.4,
      },
    ]) : []),
  ];

  return (
    <Card testID="admin-metrics">
      <View style={{ gap: p.space.sm }}>
        <Text variant="kicker" color="muted">
          {t('admin.metric.title', { days: metrics.windowDays })}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body" color="muted">{t('admin.metric.orders')}</Text>
          <Text variant="body" bold>{metrics.orders}</Text>
        </View>
        {rows
          .filter((r) => r.value !== null)
          .map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color="muted">{r.label}</Text>
              <Text variant="body" bold color={r.bad ? 'danger' : 'primary'}>{r.value}</Text>
            </View>
          ))}
      </View>
    </Card>
  );
}
