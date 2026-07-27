import React, { useState } from 'react';
import { View, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Badge, Card, PhotoBlock, RoundButton } from '../../../ui/Surface';
import { useRestaurant, useMenu } from '../hooks';
import { useCartStore } from '../../cart/cartStore';
import { DELIVERY_FEE } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { MenuItem } from '../../../data/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'RestaurantDetail'>;

export function RestaurantDetailScreen({ navigation, route }: Props) {
  const { restaurantId } = route.params;
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: menu = [] } = useMenu(restaurantId);
  const cart = useCartStore();
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  const canOrder = restaurant?.isOpen ?? false;
  const lineCount = cart.restaurantId === restaurantId ? cart.lines.reduce((s, l) => s + l.quantity, 0) : 0;

  function addOrCustomize(item: MenuItem) {
    // เมนูที่มีตัวเลือก → ไปหน้า customize; ไม่มี → เพิ่มลงตะกร้าตรงๆ
    if (item.optionGroups?.length) {
      navigation.navigate('MenuItem', { restaurantId, menuItemId: item.id });
    } else {
      cart.addItem(restaurantId, item);
    }
  }
  function tryAdd(item: MenuItem) {
    if (cart.restaurantId && cart.restaurantId !== restaurantId) {
      setPendingItem(item);
      return;
    }
    addOrCustomize(item);
  }
  function confirmDifferent() {
    if (!pendingItem) return;
    cart.clear();
    const item = pendingItem;
    setPendingItem(null);
    addOrCustomize(item);
  }

  return (
    <SafeAreaView testID="screen-restaurant-detail" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* รูปหน้าร้านเต็มความกว้าง + ปุ่มย้อนกลับลอยทับ ตาม design */}
        <View>
          <PhotoBlock height={188} radius={0} />
          <View style={{ position: 'absolute', top: p.space.lg, left: p.space.lg }}>
            <RoundButton icon="chevronLeft" onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')} />
          </View>
        </View>

        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.lg, gap: p.space.md }}>
          <Text variant="h1">{restaurant?.name ?? ''}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
            {restaurant ? (
              <>
                <Badge label={`${restaurant.prepTimeMinutes} ${t('customer.home.minutes')}`} tone="brand" />
                <Badge label={`${t('customer.home.deliveryFee')} ${formatBaht(DELIVERY_FEE)}`} tone="teal" />
                <Badge label={`${restaurant.distanceKm} ${t('customer.home.km')}`} tone="neutral" />
              </>
            ) : null}
          </View>

          {!canOrder ? (
            <Text variant="small" color="danger" bold>{t('customer.restaurant.closed')}</Text>
          ) : null}

          <Text variant="kicker" color="muted" style={{ marginTop: p.space.sm }}>
            {t('customer.restaurant.menu')}
          </Text>
        </View>

        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md, gap: p.space.lg }}>
          {menu.map((item) => (
            <Pressable
              key={item.id}
              testID={`add-${item.id}`}
              accessibilityRole="button"
              disabled={!canOrder}
              onPress={() => tryAdd(item)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.md,
                opacity: pressed ? 0.85 : canOrder ? 1 : 0.5,
              })}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="body" bold>{item.name}</Text>
                {item.description ? (
                  <Text variant="caption" color="muted" numberOfLines={2}>{item.description}</Text>
                ) : null}
                <Text variant="small" color="onTealTint" bold style={{ marginTop: 3 }}>
                  {formatBaht(item.price)}
                </Text>
              </View>

              {/* รูปเมนู + ปุ่มบวกมุมล่างขวาตาม design */}
              <View>
                <PhotoBlock size={74} radius={p.radius.md} />
                <View
                  style={[
                    {
                      position: 'absolute',
                      right: -8,
                      bottom: -8,
                      width: 32,
                      height: 32,
                      borderRadius: 12,
                      backgroundColor: canOrder ? tokens.brandAccent : tokens.borderSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    canOrder ? p.shadow.brand : null,
                  ]}
                >
                  <Icon name="plus" color={canOrder ? '#FFFFFF' : tokens.textFaint} size={18} strokeWidth={2.8} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {lineCount > 0 ? (
        <View style={{ position: 'absolute', left: p.space.screen, right: p.space.screen, bottom: p.space.screen }}>
          <Button
            testID="cart-bar"
            label={`${t('customer.restaurant.viewCart')} · ${lineCount} ${t('customer.restaurant.items')}`}
            trailingLabel={formatBaht(cart.foodTotal())}
            onPress={() => navigation.navigate('Cart')}
          />
        </View>
      ) : null}

      <Modal visible={pendingItem !== null} transparent animationType="fade" onRequestClose={() => setPendingItem(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(27,25,23,0.55)', justifyContent: 'center', padding: p.space.xl }}>
          <Card testID="confirm-different" style={{ gap: p.space.md, padding: p.space.xl }}>
            <Text variant="h3">{t('customer.restaurant.differentTitle')}</Text>
            <Text variant="body" color="muted">{t('customer.restaurant.differentBody')}</Text>
            <Button testID="confirm-clear-add" label={t('customer.restaurant.clearAndAdd')} onPress={confirmDifferent} />
            <Button testID="confirm-cancel" label={t('customer.restaurant.cancel')} variant="secondary" onPress={() => setPendingItem(null)} />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
