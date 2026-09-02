import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Badge, Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import { ADMIN_TAB_CLEARANCE } from '../../../app/navigators/AdminTabBar';
import { useAdminOrders } from '../hooks';
import { isDelayed } from '../../../lib/adminOrders';
import { orderStatusTone } from '../orderStatusTone';
import type { AdminOrderFilter, AdminOrderRow } from '../../../data/types';

const FILTERS: AdminOrderFilter[] = ['all', 'delayed', 'unassigned'];

/** AD2 ออเดอร์ทุกใบ พร้อมตัวกรองสามค่า */
export function AdminOrdersScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const [filter, setFilter] = useState<AdminOrderFilter>('all');
  const { data: orders = [], isLoading } = useAdminOrders(filter);

  return (
    <SafeAreaView
      testID="screen-admin-orders"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: ADMIN_TAB_CLEARANCE,
          gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1">{t('admin.orders.title')}</Text>

        <View style={{ flexDirection: 'row', gap: p.space.sm }}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                testID={`filter-${f}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f)}
                style={{
                  paddingVertical: p.space.xs,
                  paddingHorizontal: p.space.md,
                  borderRadius: p.radius.pill,
                  backgroundColor: active ? tokens.brandSolid : tokens.bgSunken,
                }}
              >
                <Text
                  variant="small"
                  bold
                  style={{ color: active ? tokens.textOnBrand : tokens.textMuted }}
                >
                  {t(`admin.orders.filter.${f}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? null : orders.length === 0 ? (
          /** รายการว่างต้องบอกว่าว่างเพราะอะไร ไม่ใช่ปล่อยจอเปล่าที่อ่านเหมือนโหลดค้าง */
          <Text testID="admin-orders-empty" variant="body" color="muted">
            {t(`admin.orders.empty.${filter}`)}
          </Text>
        ) : (
          orders.map((o) => <OrderRow key={o.id} order={o} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderRow({ order }: { order: AdminOrderRow }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const late = isDelayed(order);

  return (
    <Card testID={`admin-order-${order.id}`}>
      <View style={{ gap: p.space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="h3" numberOfLines={1}>{order.reference}</Text>
          </View>
          <Badge
            label={t(`customer.orders.status.${order.status}`)}
            tone={orderStatusTone(order.status, late)}
          />
        </View>

        <Text variant="small" color="muted" numberOfLines={1}>
          {order.restaurantName} → {order.dropoffLabel}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.sm }}>
          {/* ยังไม่มีไรเดอร์ต้องอ่านออกว่า "ยังไม่มี" ไม่ใช่ช่องว่างหรือขีด (§10) */}
          <Text
            testID={`admin-order-rider-${order.id}`}
            variant="small"
            color={order.riderName ? 'muted' : 'danger'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {order.riderName ?? t('admin.orders.noRider')}
          </Text>
          <Text variant="small" bold>{formatBaht(order.grandTotalSatang)}</Text>
        </View>

        <Text variant="caption" color={late ? 'danger' : 'muted'}>
          {t('admin.orders.elapsed', { count: order.minutesElapsed })}
        </Text>
      </View>
    </Card>
  );
}
