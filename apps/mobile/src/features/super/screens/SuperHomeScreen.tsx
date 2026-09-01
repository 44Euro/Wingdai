import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip } from '../../../ui/Surface';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useAuthStore } from '../../auth/authStore';
import { SUPER_TAB_CLEARANCE } from '../../../app/navigators/SuperAdminTabBar';
import type { SuperStackParamList, SuperTabParamList } from '../../../app/navigators/SuperAdminStack';
import { useSuperMetrics } from '../hooks';
/** ยืมการ์ดตัวเลขของฝั่งแอดมินมาทั้งใบ กฎ "ค่าที่วัดไม่ได้ซ่อนทั้งแถว" ต้องมีที่เดียว */
import { MetricsCard } from '../../admin/components/MetricsCard';
import { SkeletonCards } from '../../../ui/motion';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperTabParamList, 'SuperHome'>,
  NativeStackScreenProps<SuperStackParamList>
>;

/** หน้าต่างเวลาที่เลือกได้ เดือน/ไตรมาส/ปี คือช่วงที่คำถาม "โมเดลเวิร์กไหม" ตอบได้จริง */
const WINDOWS = [30, 90, 365] as const;

/** SA1 "โมเดลยังทำกำไรอยู่ไหม" */
export function SuperHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const [days, setDays] = useState<number>(30);
  const logout = useAuthStore((s) => s.logout);

  const { data: metrics, isPending } = useSuperMetrics(days);

  return (
    <SafeAreaView
      testID="screen-super-home"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: SUPER_TAB_CLEARANCE, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
          <Text variant="h1">{t('super.home.title')}</Text>
          <Text variant="small" color="muted">{t('super.home.subtitle')}</Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: p.space.sm,
            paddingHorizontal: p.space.screen,
          }}
        >
          {WINDOWS.map((w) => (
            <Chip
              key={w}
              testID={`super-window-${w}`}
              label={t('super.home.window', { count: w })}
              active={days === w}
              onPress={() => setDays(w)}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: p.space.screen }}>
          {metrics ? (
            <MetricsCard metrics={metrics} full />
          ) : isPending ? (
            <SkeletonCards testID="super-metrics-loading" count={1} photoHeight={0} />
          ) : (
            <Card>
              <Text variant="body" color="muted">{t('super.home.metricsUnavailable')}</Text>
            </Card>
          )}
        </View>

        <View style={{ paddingHorizontal: p.space.screen }}>
          <Button
            testID="btn-super-roles"
            variant="secondary"
            label={t('super.home.manageRoles')}
            onPress={() => navigation.navigate('SuperRoles')}
          />
        </View>

        {/* ทางกลับไปทำงานแอดมินประจำวัน ซูเปอร์แอดมินคือคนเดิมที่มีสิทธิ์เพิ่ม */}
        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
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
