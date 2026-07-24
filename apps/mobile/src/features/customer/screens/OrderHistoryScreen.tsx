import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { useCustomerOrders, useRestaurants } from '../hooks';
import { formatBaht } from '../../../lib/format';
import type { Order } from '../../../data/types';

export function OrderHistoryScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: orders = [] } = useCustomerOrders();
  const { data: restaurants = [] } = useRestaurants();

  const nameOf = (restaurantId: string) => restaurants.find((r) => r.id === restaurantId)?.name ?? restaurantId;
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <SafeAreaView testID="screen-order-history" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.md }}>
        <Text variant="h1">{t('customer.orders.title')}</Text>
        {sorted.length === 0 ? (
          <Text testID="orders-empty" variant="body" color="muted">{t('customer.orders.empty')}</Text>
        ) : (
          sorted.map((o) => <OrderCard key={o.id} order={o} restaurantName={nameOf(o.restaurantId)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, restaurantName }: { order: Order; restaurantName: string }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const grandTotal = order.foodTotal + order.deliveryFee + order.serviceFee;
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <View
      testID={`order-${order.id}`}
      style={{ backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg, gap: p.space.xs }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="body" style={{ fontFamily: p.fontFamily.bodyBold }}>{restaurantName}</Text>
        <Text variant="caption" color="brand">{t(`customer.orders.status.${order.status}`)}</Text>
      </View>
      <Text variant="small" color="muted">
        {itemCount} {t('customer.restaurant.items')} · {formatBaht(grandTotal)}
      </Text>
    </View>
  );
}
