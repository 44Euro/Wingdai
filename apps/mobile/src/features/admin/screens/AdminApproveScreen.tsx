import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { ADMIN_TAB_CLEARANCE } from '../../../app/navigators/AdminTabBar';
import type { AdminStackParamList, AdminTabParamList } from '../../../app/navigators/AdminStack';
import { usePendingRestaurants, usePendingRiders } from '../hooks';
import { ShopCard } from '../components/ShopCard';
import { RiderCard } from '../components/RiderCard';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminApprove'>,
  NativeStackScreenProps<AdminStackParamList>
>;

/** AD3 + AD6 รวมเป็นแท็บเดียว "ใครรออนุมัติ" */
export function AdminApproveScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: pendingShops = [] } = usePendingRestaurants();
  const { data: pendingRiders = [] } = usePendingRiders();

  return (
    <SafeAreaView
      testID="screen-admin-approve"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: ADMIN_TAB_CLEARANCE,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1">{t('admin.approve.title')}</Text>

        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.pendingShops', { count: pendingShops.length })}
          </Text>
          {pendingShops.length === 0 ? (
            <Text testID="admin-no-shops" variant="body" color="muted">
              {t('admin.noPendingShops')}
            </Text>
          ) : (
            pendingShops.map((s) => <ShopCard key={s.id} shop={s} />)
          )}
        </View>

        <View style={{ gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.riders.title')} ({pendingRiders.length})
          </Text>
          {pendingRiders.length === 0 ? (
            <Text testID="admin-no-riders" variant="body" color="muted">
              {t('admin.riders.empty')}
            </Text>
          ) : (
            pendingRiders.map((r) => (
              <RiderCard
                key={r.accountId}
                rider={r}
                onOpenDocuments={(accountId) =>
                  navigation.navigate('AdminRiderDocs', { accountId, name: r.fullName })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
