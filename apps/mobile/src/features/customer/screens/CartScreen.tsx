import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Card, PhotoBlock } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { useCartStore } from '../../cart/cartStore';
import { useRestaurant } from '../hooks';
import { orderTotals } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Cart'>;

export function CartScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const cart = useCartStore();
  const totals = orderTotals(cart.foodTotal());
  const { data: restaurant } = useRestaurant(cart.restaurantId ?? '');

  if (cart.lines.length === 0) {
    return (
      <SafeAreaView testID="screen-cart" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
        <ScreenHeader title={t('customer.cart.title')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44, gap: p.space.md }}>
          <View
            style={[
              {
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: tokens.bgRaised,
                alignItems: 'center',
                justifyContent: 'center',
              },
              p.shadow.raised,
            ]}
          >
            <Icon name="cart" color={tokens.textFaint} size={50} strokeWidth={1.7} />
          </View>
          <Text testID="cart-empty" variant="h2" style={{ marginTop: p.space.sm, textAlign: 'center' }}>
            {t('customer.cart.empty')}
          </Text>
          <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
            {t('customer.cart.emptyBody')}
          </Text>
        </View>
        <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg }}>
          <Button label={t('customer.cart.browse')} onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="small" color={bold ? 'primary' : 'muted'} bold={bold}>{label}</Text>
      <Text variant={bold ? 'body' : 'small'} color={bold ? 'brand' : 'primary'} bold style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );

  return (
    <SafeAreaView testID="screen-cart" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('customer.cart.title')} onBack={() => navigation.goBack()} />

      {/* C4 บอกว่าตะกร้าใบนี้เป็นของร้านไหน — ตะกร้าถือได้ร้านเดียวต่อครั้ง */}
      {restaurant ? (
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: p.space.screen, paddingBottom: 6 }}>
          <Text variant="caption" color="muted">
            {t('customer.cart.from')}
          </Text>
          <Text testID="cart-restaurant" variant="caption" bold numberOfLines={1} style={{ flexShrink: 1 }}>
            {restaurant.name}
          </Text>
          <Text variant="caption" color="muted">
            · {restaurant.distanceKm} {t('customer.home.km')}
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.xl, gap: p.space.md }}
        showsVerticalScrollIndicator={false}
      >
        {cart.lines.map((l) => (
          <Card key={l.lineId} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
            <PhotoBlock size={56} radius={p.radius.sm} />

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="small" bold numberOfLines={1}>{l.name}</Text>
              {l.selectedChoices.length > 0 ? (
                <Text variant="caption" color="muted" numberOfLines={1}>
                  {l.selectedChoices.map((c) => c.name).join(', ')}
                </Text>
              ) : null}
              <Text variant="small" color="onTealTint" bold style={{ marginTop: 3 }}>
                {formatBaht(l.unitPrice)}
              </Text>
            </View>

            {/* แถบจำนวนทรงพิลตาม design */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.sm,
                backgroundColor: tokens.bgSunken,
                borderRadius: p.radius.full,
                padding: 5,
              }}
            >
              <Pressable
                testID={`qty-dec-${l.lineId}`}
                accessibilityRole="button"
                accessibilityLabel="ลดจำนวน"
                onPress={() => cart.setQuantity(l.lineId, l.quantity - 1)}
                hitSlop={10}
                style={[
                  { width: 28, height: 28, borderRadius: 14, backgroundColor: tokens.bgRaised, alignItems: 'center', justifyContent: 'center' },
                  p.shadow.card,
                ]}
              >
                <Icon name="minus" color={tokens.textPrimary} size={16} strokeWidth={2.8} />
              </Pressable>
              <Text variant="small" bold style={{ minWidth: 14, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                {l.quantity}
              </Text>
              <Pressable
                testID={`qty-inc-${l.lineId}`}
                accessibilityRole="button"
                accessibilityLabel="เพิ่มจำนวน"
                onPress={() => cart.setQuantity(l.lineId, l.quantity + 1)}
                hitSlop={10}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tokens.brandAccent, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="plus" color="#FFFFFF" size={16} strokeWidth={2.8} />
              </Pressable>
            </View>
          </Card>
        ))}

        {/* สรุปค่าใช้จ่าย — ค่าส่ง/ค่าบริการแยกบรรทัดเสมอ ห้ามบวกทับราคาอาหาร (claude.md §3) */}
        <Card style={{ gap: p.space.sm, marginTop: p.space.xs }}>
          <Row label={t('customer.cart.foodTotal')} value={formatBaht(totals.foodTotal)} />
          <Row label={t('customer.cart.deliveryFee')} value={formatBaht(totals.deliveryFee)} />
          <Row label={t('customer.cart.serviceFee')} value={formatBaht(totals.serviceFee)} />
          <View
            style={{
              borderBottomWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: tokens.borderSubtle,
              marginVertical: p.space.sm,
            }}
          />
          <Row label={t('customer.cart.grandTotal')} value={formatBaht(totals.grandTotal)} bold />
        </Card>
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, paddingTop: p.space.sm }}>
        <Button
          testID="btn-place-order"
          label={t('customer.cart.placeOrder')}
          trailingLabel={formatBaht(totals.grandTotal)}
          onPress={() => navigation.navigate('Checkout')}
        />
      </View>
    </SafeAreaView>
  );
}
