import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { OpsMapView } from '../components/OpsMapView';
import type { AdminStackParamList } from '../../../app/navigators/AdminStack';
import { useOpsMap } from '../hooks';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMap'>;

/** AD8 แผนที่ภาพรวม ไรเดอร์ + ออเดอร์ที่ยังวิ่ง */
export function AdminMapScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data } = useOpsMap();

  const riders = data?.riders ?? [];
  const orders = data?.orders ?? [];

  return (
    <SafeAreaView
      testID="screen-admin-map"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('admin.map.title')} onBack={() => navigation.goBack()} />

      <View style={{ flex: 1 }}>
        <OpsMapView riders={riders} orders={orders} />

        <View style={{ position: 'absolute', left: p.space.lg, right: p.space.lg, bottom: p.space.lg }}>
          <Card testID="admin-map-legend">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Legend
                color={tokens.brandAccent}
                label={t('admin.map.riders', { count: riders.length })}
              />
              <Legend
                color={tokens.tealSolid}
                label={t('admin.map.orders', { count: orders.length })}
              />
              <Legend
                color={tokens.danger}
                label={t('admin.map.unassigned', {
                  count: orders.filter((o) => !o.hasRider).length,
                })}
              />
            </View>
          </Card>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { primitives: p } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.xs }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text variant="caption" color="muted">{label}</Text>
    </View>
  );
}
