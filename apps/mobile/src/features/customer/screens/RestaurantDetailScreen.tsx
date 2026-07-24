import React, { useState } from 'react';
import { View, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { useRestaurant, useMenu } from '../hooks';
import { useCartStore } from '../../cart/cartStore';
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
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.md, paddingBottom: 96 }}>
        <Text variant="h1">{restaurant?.name ?? ''}</Text>
        {!canOrder ? <Text variant="small" style={{ color: tokens.danger }}>{t('customer.restaurant.closed')}</Text> : null}
        <Text variant="h3" style={{ marginTop: p.space.sm }}>{t('customer.restaurant.menu')}</Text>

        {menu.map((item) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: p.space.md,
              backgroundColor: tokens.bgRaised,
              borderRadius: p.radius.md,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              padding: p.space.lg,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="body">{item.name}</Text>
              {item.description ? <Text variant="caption" color="muted">{item.description}</Text> : null}
              <Text variant="small" color="muted">{formatBaht(item.price)}</Text>
            </View>
            <Pressable
              testID={`add-${item.id}`}
              disabled={!canOrder}
              onPress={() => tryAdd(item)}
              hitSlop={8}
              style={{
                minWidth: 44,
                minHeight: 44,
                borderRadius: p.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: canOrder ? tokens.brandSolid : tokens.borderSubtle,
                paddingHorizontal: p.space.lg,
              }}
            >
              <Text variant="small" color={canOrder ? 'onBrand' : 'muted'}>{t('customer.restaurant.add')}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {lineCount > 0 ? (
        <Pressable
          testID="cart-bar"
          onPress={() => navigation.navigate('Cart')}
          style={{
            position: 'absolute',
            left: p.space.xl,
            right: p.space.xl,
            bottom: p.space.xl,
            minHeight: 52,
            borderRadius: p.radius.md,
            backgroundColor: tokens.brandSolid,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: p.space.xl,
          }}
        >
          <Text variant="body" color="onBrand">{t('customer.restaurant.viewCart')} · {lineCount} {t('customer.restaurant.items')}</Text>
          <Text variant="body" color="onBrand" style={{ fontFamily: p.fontFamily.bodyBold }}>{formatBaht(cart.foodTotal())}</Text>
        </Pressable>
      ) : null}

      <Modal visible={pendingItem !== null} transparent animationType="fade" onRequestClose={() => setPendingItem(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: p.space.xl }}>
          <View testID="confirm-different" style={{ backgroundColor: tokens.bgRaised, borderRadius: p.radius.lg, padding: p.space.xl, gap: p.space.md }}>
            <Text variant="h3">{t('customer.restaurant.differentTitle')}</Text>
            <Text variant="body" color="muted">{t('customer.restaurant.differentBody')}</Text>
            <Button testID="confirm-clear-add" label={t('customer.restaurant.clearAndAdd')} onPress={confirmDifferent} />
            <Button testID="confirm-cancel" label={t('customer.restaurant.cancel')} variant="secondary" onPress={() => setPendingItem(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
