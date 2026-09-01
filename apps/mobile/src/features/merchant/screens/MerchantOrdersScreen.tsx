import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { Badge, Card, Chip, Toggle } from '../../../ui/Surface';
import { SkeletonCards } from '../../../ui/motion';
import { formatBaht } from '../../../lib/format';
import {
  useMerchantOrders, useMyRestaurants, useSetRestaurantOpen, useTicker,
} from '../hooks';
import { secondsLeftToAccept, acceptUrgency } from '../acceptWindow';
import { MERCHANT_TAB_CLEARANCE } from '../../../app/navigators/MerchantTabBar';
import type { MerchantOrder } from '../../../data/types';
import type { MerchantStackParamList, MerchantTabParamList } from '../../../app/navigators/MerchantStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MerchantTabParamList, 'MerchantOrders'>,
  NativeStackScreenProps<MerchantStackParamList>
>;

/** M3 คิวออเดอร์ของร้าน */
export function MerchantOrdersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const [scope, setScope] = useState<'queue' | 'history'>('queue');

  const { data: shops = [] } = useMyRestaurants();
  const { data: orders = [], isLoading } = useMerchantOrders(scope);
  const setOpen = useSetRestaurantOpen();

  // นาฬิกาเดินเฉพาะตอนดูคิว อยู่หน้าประวัติแล้วยังปลุก JS ทุกวินาทีคือกินแบตเปล่า
  const now = useTicker(scope === 'queue');

  const shop = shops[0];
  const waiting = orders.filter((o) => o.status === 'created').length;

  return (
    <SafeAreaView
      testID="screen-merchant-orders"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: MERCHANT_TAB_CLEARANCE, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: p.space.screen,
            paddingTop: p.space.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="h1">{t('merchant.orders.title')}</Text>
            {waiting > 0 ? (
              <Text testID="queue-waiting" variant="small" color="danger" bold>
                {t('merchant.orders.waiting', { count: waiting })}
              </Text>
            ) : null}
          </View>
        </View>

        {shop ? (
          <View style={{ paddingHorizontal: p.space.screen }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{shop.name}</Text>
                  <Text variant="small" color="muted">
                    {shop.isOpen ? t('merchant.orders.open') : t('merchant.orders.closed')}
                    {' · '}
                    {t('merchant.orders.prepTime', { minutes: shop.prepTimeMinutes })}
                  </Text>
                </View>
                {/* ปิดร้านคือ "หยุดรับออเดอร์ใหม่" ไม่ใช่ทิ้งใบที่ค้างอยู่ */}
                <Toggle
                  testID="toggle-shop-open"
                  value={shop.isOpen}
                  accessibilityLabel={t('merchant.orders.toggleOpen')}
                  onValueChange={(isOpen) => setOpen.mutate({ restaurantId: shop.id, isOpen })}
                />
              </View>
            </Card>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            alignItems: 'center', gap: p.space.sm, paddingHorizontal: p.space.screen }}
        >
          {(['queue', 'history'] as const).map((s) => (
            <Chip
              key={s}
              testID={`merchant-scope-${s}`}
              label={t(`merchant.orders.scope.${s}`)}
              active={s === scope}
              onPress={() => setScope(s)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          {isLoading ? (
            <SkeletonCards testID="queue-loading" count={3} photoHeight={0} />
          ) : orders.length === 0 ? (
            <Text testID="queue-empty" variant="body" color="muted">
              {t(`merchant.orders.empty.${scope}`)}
            </Text>
          ) : (
            orders.map((o) => (
              <QueueCard
                key={o.id}
                order={o}
                now={now}
                onPress={() => navigation.navigate('MerchantOrderDetail', { orderId: o.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_TONE: Record<string, 'brand' | 'teal' | 'neutral'> = {
  created: 'brand',
  accepted: 'teal',
  preparing: 'teal',
  picked_up: 'neutral',
  delivered: 'neutral',
  cancelled: 'neutral',
};

function QueueCard({
  order,
  now,
  onPress,
}: {
  order: MerchantOrder;
  now: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const count = order.items.reduce((s, i) => s + i.quantity, 0);
  const isNew = order.status === 'created';
  const left = secondsLeftToAccept(order.createdAt, now);
  const urgency = acceptUrgency(left);

  return (
    <Pressable testID={`queue-card-${order.id}`} onPress={onPress}>
      <Card>
        <View style={{ gap: p.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{order.reference}</Text>
              <Text variant="small" color="muted">
                {order.customerName} · {t('merchant.orders.items', { count })}
              </Text>
            </View>
            <Badge
              label={t(`merchant.orders.status.${order.status}`)}
              tone={STATUS_TONE[order.status] ?? 'neutral'}
            />
          </View>

          {isNew ? (
            <View
              testID={`queue-countdown-${order.id}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.sm,
                backgroundColor: urgency === 'calm' ? tokens.bgSunken : tokens.brandTint,
                paddingHorizontal: p.space.md,
                paddingVertical: p.space.sm,
                borderRadius: p.radius.md,
              }}
            >
              <Icon
                name="clock"
                size={16}
                color={urgency === 'calm' ? tokens.textMuted : tokens.danger}
              />
              <Text variant="small" color={urgency === 'calm' ? 'muted' : 'danger'} bold>
                {urgency === 'late'
                  ? t('merchant.orders.overdue')
                  : t('merchant.orders.secondsLeft', { count: left })}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 2 }}>
            {order.items.map((i, idx) => (
              <View key={`${i.name}-${idx}`}>
                <Text variant="small" color="muted">
                  {i.quantity}× {i.name}
                </Text>
                {/* คำสั่งพิเศษต้องเด่นกว่าชื่อจาน ครัวพลาดบรรทัดนี้ = ทำผิดทั้งจาน */}
                {i.note ? (
                  <Text testID={`item-note-${idx}`} variant="small" color="brand" bold>
                    ↳ {i.note}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {/* ยอดที่โชว์คือ "ร้านได้เท่าไหร่" ไม่ใช่ยอดที่ลูกค้าจ่าย */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderTopColor: tokens.borderSubtle,
              paddingTop: p.space.sm,
            }}
          >
            <Text variant="small" color="muted">
              {t('merchant.orders.payout')}
            </Text>
            <Text variant="body" bold>
              {formatBaht(order.restaurantPayout)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
