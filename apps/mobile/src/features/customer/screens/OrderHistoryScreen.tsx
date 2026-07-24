import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Badge, Card, Chip, PhotoBlock } from '../../../ui/Surface';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';
import { useCustomerOrders, useReorder, useRestaurants } from '../hooks';
import { Button } from '../../../ui/Button';
import { formatBaht } from '../../../lib/format';
import type { Order, OrderStatus } from '../../../data/types';
import type { ReorderPlan } from '../reorder';
import type { CustomerStackParamList, CustomerTabParamList } from '../../../app/navigators/CustomerStack';

// อยู่ในแท็บ แต่ต้อง navigate ไปจอที่อยู่ใน stack แม่ (ใบเสร็จ/ติดตาม) → composite
type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Orders'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

type Filter = 'all' | 'active' | 'past';
const DONE: OrderStatus[] = ['delivered', 'cancelled'];

export function OrderHistoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: orders = [] } = useCustomerOrders();
  const { data: restaurants = [] } = useRestaurants();
  const [filter, setFilter] = useState<Filter>('all');
  const reorder = useReorder();

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
            shown.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                restaurantName={nameOf(o.restaurantId)}
                /** จบแล้วไปใบเสร็จ ยังไม่จบไปจอติดตาม */
                onPress={() =>
                  DONE.includes(o.status)
                    ? navigation.navigate('Receipt', { orderId: o.id })
                    : navigation.navigate('OrderTracking', { orderId: o.id })
                }
                /** C33 สั่งซ้ำเฉพาะใบที่ส่งถึงแล้ว ไม่ใช่ใบที่ถูกยกเลิก */
                onReorder={
                  o.status === 'delivered'
                    ? () =>
                        reorder.mutate(o, {
                          onSuccess: (plan) => {
                            /** ใส่ได้ครบ = พาไปตะกร้าเลย (ทางปกติ กดครั้งเดียวจบ) */
                            if (plan.unavailable.length === 0 && plan.lines.length > 0) {
                              navigation.navigate('Cart');
                            }
                          },
                        })
                    : undefined
                }
                reorderBusy={reorder.isPending}
                reorderResult={reorder.variables?.id === o.id ? reorder.data : undefined}
                onGoToCart={() => navigation.navigate('Cart')}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({
  order,
  restaurantName,
  onPress,
  onReorder,
  reorderBusy,
  reorderResult,
  onGoToCart,
}: {
  order: Order;
  restaurantName: string;
  onPress: () => void;
  onReorder?: () => void;
  reorderBusy?: boolean;
  /** ผลของการกดสั่งซ้ำใบนี้ undefined = ยังไม่ได้กด หรือกดใบอื่น */
  reorderResult?: ReorderPlan;
  onGoToCart: () => void;
}) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const grandTotal = order.foodTotal + order.deliveryFee + order.serviceFee;
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const done = DONE.includes(order.status);

  return (
    <Pressable
      testID={`order-${order.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
    <Card style={{ gap: p.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
        <PhotoBlock size={48} radius={p.radius.sm} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="small" bold numberOfLines={1}>{restaurantName}</Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {itemCount} {t('customer.restaurant.items')} · {formatBaht(grandTotal)}
          </Text>
          {/* บอกด้วยว่าสั่งอะไรไป "3 รายการ" อย่างเดียวจำไม่ได้ว่าใบไหนเป็นใบไหน */}
          <Text variant="caption" color="faint" numberOfLines={1}>
            {order.items.map((i) => i.name).join(' · ')}
          </Text>
        </View>
        <Badge label={t(`customer.orders.status.${order.status}`)} tone={done ? 'teal' : 'brand'} />
      </View>
      {onReorder ? (
        <Button
          testID={`btn-reorder-${order.id}`}
          variant="secondary"
          label={t('customer.orders.reorder')}
          disabled={reorderBusy}
          onPress={onReorder}
        />
      ) : null}

      {reorderResult && reorderResult.unavailable.length > 0 ? (
        <View style={{ gap: p.space.xs }}>
          <Text testID={`reorder-unavailable-${order.id}`} variant="caption" color="danger">
            {t('customer.orders.reorderUnavailable', {
              items: reorderResult.unavailable.join(', '),
            })}
          </Text>
          {reorderResult.lines.length > 0 ? (
            <Button
              testID={`btn-reorder-continue-${order.id}`}
              variant="secondary"
              label={t('customer.orders.reorderContinue')}
              onPress={onGoToCart}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
    </Pressable>
  );
}
