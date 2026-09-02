import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import { ADMIN_TAB_CLEARANCE } from '../../../app/navigators/AdminTabBar';
import type { AdminStackParamList, AdminTabParamList } from '../../../app/navigators/AdminStack';
import { WhoAmICard } from '../components/WhoAmICard';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useAuthStore } from '../../auth/authStore';
import { useExceptions, useAdminMetrics, useLiveOps } from '../hooks';
import { MetricsCard } from '../components/MetricsCard';
import { ExceptionCard } from '../components/ExceptionCard';
import type { LiveOps } from '../../../data/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminHome'>,
  NativeStackScreenProps<AdminStackParamList>
>;

/** AD1 "ตอนนี้อะไรกำลังไหม้" */
export function AdminHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const logout = useAuthStore((s) => s.logout);

  const { data: exceptions = [] } = useExceptions();
  const { data: metrics } = useAdminMetrics();
  const { data: live } = useLiveOps();

  return (
    <SafeAreaView
      testID="stack-admin"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: ADMIN_TAB_CLEARANCE, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
          <Text variant="h1">{t('admin.title')}</Text>
          <Text variant="small" color="muted">{t('admin.subtitle')}</Text>
        </View>

        {live ? (
          <View style={{ paddingHorizontal: p.space.screen }}>
            <LiveOpsCard live={live} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: p.space.screen }}>
          <Button
            testID="btn-ops-map"
            variant="secondary"
            label={t('admin.openMap')}
            onPress={() => navigation.navigate('AdminMap')}
          />
        </View>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.exceptions', { count: exceptions.length })}
          </Text>
          {exceptions.length === 0 ? (
            /** ไม่มีอะไรต้องทำคือข่าวดี ต้องเขียนให้อ่านแล้วรู้ว่าดี ไม่ใช่หน้าว่างที่ดูเหมือนโหลดไม่ขึ้น */
            <Text testID="admin-all-clear" variant="body" color="success">
              {t('admin.allClear')}
            </Text>
          ) : (
            exceptions.map((e) => <ExceptionCard key={`${e.kind}-${e.orderId}`} exception={e} />)
          )}
        </View>

        {metrics ? (
          <View style={{ paddingHorizontal: p.space.screen }}>
            <MetricsCard metrics={metrics} />
          </View>
        ) : null}

        {/* ตัวสลับโหมด + ออกจากระบบ อยู่ท้ายจอแรกเพราะ AdminStack ไม่มีจอโปรไฟล์ */}
        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          <WhoAmICard />
          {/* ภาษาและธีมอยู่จอเดียวกันทุกบทบาท ไม่ได้ทำจอตั้งค่าแยกต่อบทบาท */}
          <Button
            testID="btn-go-settings"
            variant="secondary"
            label={t('settings.title')}
            onPress={() => navigation.navigate('Settings')}
          />

          <RoleSwitcher />
          <Button
            testID="btn-logout"
            variant="secondary"
            label={t('customer.profile.logout')}
            onPress={() => logout()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** ตัวเลข "ตอนนี้" ต่างจาก `MetricsCard` ที่เป็นค่าเฉลี่ยย้อนหลังหลายวัน */
function LiveOpsCard({ live }: { live: LiveOps }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();

  const rows: { label: string; value: string; bad?: boolean }[] = [
    { label: t('admin.live.activeOrders'), value: String(live.activeOrders) },
    { label: t('admin.live.ridersOnline'), value: String(live.ridersOnline) },
    { label: t('admin.live.unassigned'), value: String(live.unassigned), bad: live.unassigned > 0 },
    { label: t('admin.live.gmvToday'), value: formatBaht(live.gmvTodaySatang) },
  ];

  return (
    <Card testID="admin-live-ops">
      <View style={{ gap: p.space.sm }}>
        <Text variant="kicker" color="muted">{t('admin.live.title')}</Text>
        {rows.map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body" color="muted">{r.label}</Text>
            <Text variant="body" bold color={r.bad ? 'danger' : 'primary'}>{r.value}</Text>
          </View>
        ))}
        {/* วันนี้ยังไม่มีใบไหนส่งถึง = ยังวัดไม่ได้ ซ่อนทั้งแถว ไม่โชว์ 0 นาที (§10) */}
        {live.medianDeliveryMinutes !== null ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body" color="muted">{t('admin.live.medianDelivery')}</Text>
            <Text
              testID="admin-median-delivery"
              variant="body"
              bold
              color={live.medianDeliveryMinutes > 30 ? 'danger' : 'primary'}
            >
              {t('admin.live.minutes', { count: live.medianDeliveryMinutes })}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
