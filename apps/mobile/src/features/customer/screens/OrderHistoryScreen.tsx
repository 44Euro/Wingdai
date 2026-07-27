import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Badge, Card, Chip, PhotoBlock } from '../../../ui/Surface';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';
import { useCustomerOrders, useRestaurants } from '../hooks';
import { formatBaht } from '../../../lib/format';
import type { Order, OrderStatus } from '../../../data/types';

type Filter = 'all' | 'active' | 'past';
const DONE: OrderStatus[] = ['delivered', 'cancelled'];

export function OrderHistoryScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: orders = [] } = useCustomerOrders();
  const { data: restaurants = [] } = useRestaurants();
  const [filter, setFilter] = useState<Filter>('all');

  const nameOf = (restaurantId: string) => restaurants.find((r) => r.id === restaurantId)?.name ?? restaurantId;
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = sorted.filter((o) =>
    filter === 'all' ? true : filter === 'past' ? DONE.includes(o.status) : !DONE.includes(o.status),
  );

  return (
    <SafeAreaView testID="screen-order-history" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: p.space.md }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
          <Text variant="h1">{t('customer.orders.title')}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: p.space.sm, paddingHorizontal: p.space.screen }}
        >
          {(['all', 'active', 'past'] as Filter[]).map((f) => (
            <Chip
              key={f}
              testID={`order-filter-${f}`}
              label={t(`customer.orders.filter${f.charAt(0).toUpperCase()}${f.slice(1)}`)}
              active={f === filter}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          {shown.length === 0 ? (
            <Text testID="orders-empty" variant="body" color="muted">{t('customer.orders.empty')}</Text>
          ) : (
            shown.map((o) => <OrderCard key={o.id} order={o} restaurantName={nameOf(o.restaurantId)} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, restaurantName }: { order: Order; restaurantName: string }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const grandTotal = order.foodTotal + order.deliveryFee + order.serviceFee;
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const done = DONE.includes(order.status);

  return (
    <Card testID={`order-${order.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
      <PhotoBlock size={48} radius={p.radius.sm} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="small" bold numberOfLines={1}>{restaurantName}</Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {itemCount} {t('customer.restaurant.items')} · {formatBaht(grandTotal)}
        </Text>
      </View>
      <Badge label={t(`customer.orders.status.${order.status}`)} tone={done ? 'teal' : 'brand'} />
    </Card>
  );
}
