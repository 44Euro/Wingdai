import React, { useState } from 'react';
import { View, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Badge, Card, PhotoBlock, RoundButton } from '../../../ui/Surface';
import { useRestaurant, useMenu } from '../hooks';
import { useCartStore } from '../../cart/cartStore';
import { deliveryFeeLabel } from '../deliveryFeeLabel';
import { openStateLabel } from '../openStateLabel';
import { formatBaht, ratingLabel, distanceLabel } from '../../../lib/format';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { MenuItem } from '../../../data/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'RestaurantDetail'>;

export function RestaurantDetailScreen({ navigation, route }: Props) {
  const { restaurantId } = route.params;
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  // รูปเต็มขอบจึงห่อ SafeAreaView ไม่ได้ ปุ่มลอยต้องเผื่อแถบสถานะเอง
  const insets = useSafeAreaInsets();
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
          <PhotoBlock uri={restaurant?.photoUrl} height={188} radius={0} />
          {/* รูปไหลขึ้นไปใต้แถบสถานะ ปุ่มย้อนกลับต้องเผื่อ inset เอง ไม่งั้นชนรอยบาก */}
          <View style={{ position: 'absolute', top: insets.top + 14, left: 16 }}>
            <RoundButton icon="chevronLeft" onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')} />
          </View>
        </View>

        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.lg, gap: p.space.md }}>
          {/* C3: ชื่อร้าน + หมวด อยู่ซ้าย แบดจ์คะแนนสี teal อยู่ขวา */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: p.space.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="h1">{restaurant?.name ?? ''}</Text>
              {restaurant ? (
                <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
                  {t(`customer.cuisine.${restaurant.cuisine}`)}
                </Text>
              ) : null}
            </View>
            {/* ป้ายคะแนนหายไปทั้งชิ้นเมื่อยังไม่มีรีวิว ไม่ใช่โชว์ป้ายเปล่า ๆ ที่อ่านไม่ได้ความ */}
            {restaurant && ratingLabel(restaurant.rating) ? (
              <Pressable
                testID="restaurant-rating"
                accessibilityRole="button"
                accessibilityLabel={t('reviews.title')}
                onPress={() =>
                  navigation.navigate('RestaurantReviews', { restaurantId: restaurant.id })}
                style={({ pressed }) => ({
                  backgroundColor: tokens.tealSolid,
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: p.radius.sm,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text variant="caption" color="onTeal" bold>
                  {ratingLabel(restaurant.rating)}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
            {restaurant ? (
              <>
                <Badge label={`${restaurant.prepTimeMinutes} ${t('customer.home.minutes')}`} tone="brand" />
                <Badge label={`${t('customer.home.deliveryFee')} ${deliveryFeeLabel(restaurant.distanceKm, t)}`} tone="teal" />
                {distanceLabel(restaurant.distanceKm, t('customer.home.km')) ? (
                  <Badge label={distanceLabel(restaurant.distanceKm, t('customer.home.km'))!} tone="neutral" />
                ) : null}
              </>
            ) : null}
          </View>

          {/* C28 บอกด้วยว่าเปิดอีกทีเมื่อไหร่ ไม่ใช่แค่คำว่า "ปิด" */}
          {restaurant && !canOrder ? (
            <Text testID="restaurant-closed" variant="small" color="danger" bold>
              {openStateLabel(restaurant, t)}
            </Text>
          ) : null}

          <Text variant="kicker" color="muted" style={{ marginTop: p.space.sm }}>
            {t('customer.restaurant.menu')}
          </Text>
        </View>

        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md, gap: p.space.lg }}>
          {menu.map((item) => {
            // ของหมดยังโชว์อยู่ในเมนู เพราะลูกค้าควรรู้ว่าร้านมีจานนี้ แค่วันนี้ไม่มี
            const canAdd = canOrder && item.isAvailable;
            return (
            <Pressable
              key={item.id}
              testID={`add-${item.id}`}
              accessibilityRole="button"
              disabled={!canAdd}
              onPress={() => tryAdd(item)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.md,
                opacity: pressed ? 0.85 : canAdd ? 1 : 0.5,
              })}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="body" bold>{item.name}</Text>
                {item.description ? (
                  <Text variant="caption" color="muted" numberOfLines={2}>{item.description}</Text>
                ) : null}
                {item.isAvailable ? null : (
                  <Text testID={`sold-out-${item.id}`} variant="caption" color="danger" bold>
                    {t('customer.restaurant.soldOut')}
                  </Text>
                )}
                <Text variant="small" color="onTealTint" bold style={{ marginTop: 3 }}>
                  {formatBaht(item.price)}
                </Text>
              </View>

              {/* รูปเมนู + ปุ่มบวกมุมล่างขวาตาม design */}
              <View>
                <PhotoBlock uri={item.photoUrl} size={74} radius={p.radius.md} />
                <View
                  style={[
                    {
                      position: 'absolute',
                      right: -8,
                      bottom: -8,
                      width: 32,
                      height: 32,
                      borderRadius: 12,
                      backgroundColor: canAdd ? tokens.brandAccent : tokens.borderSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    // เงาต้องเล็กตามปุ่ม shadow.brand ทำมาสำหรับ CTA เต็มความกว้าง ใส่ตรงนี้จะฟุ้งเป็นวงส้ม
                    canAdd ? p.shadow.card : null,
                  ]}
                >
                  <Icon name="plus" color={canAdd ? '#FFFFFF' : tokens.textFaint} size={18} strokeWidth={2.8} />
                </View>
              </View>
            </Pressable>
            );
          })}
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
