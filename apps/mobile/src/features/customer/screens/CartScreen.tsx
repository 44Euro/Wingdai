import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { useCartStore } from '../../cart/cartStore';
import { orderTotals } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Cart'>;

export function CartScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const cart = useCartStore();
  const totals = orderTotals(cart.foodTotal());

  if (cart.lines.length === 0) {
    return (
      <SafeAreaView
        testID="screen-cart"
        edges={['bottom']}
        style={{ flex: 1, backgroundColor: tokens.bgSurface, alignItems: 'center', justifyContent: 'center', padding: p.space.xl }}
      >
        <Text testID="cart-empty" variant="body" color="muted">{t('customer.cart.empty')}</Text>
      </SafeAreaView>
    );
  }

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" color={bold ? 'primary' : 'muted'} style={bold ? { fontFamily: p.fontFamily.bodyBold } : undefined}>{label}</Text>
      <Text variant="body" style={{ fontVariant: ['tabular-nums'], ...(bold ? { fontFamily: p.fontFamily.bodyBold } : {}) }}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView testID="screen-cart" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg }}>
        {cart.lines.map((l) => (
          <View
            key={l.menuItemId}
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
              <Text variant="body">{l.name}</Text>
              <Text variant="small" color="muted">{formatBaht(l.unitPrice)}</Text>
            </View>
            <Pressable
              testID={`qty-dec-${l.menuItemId}`}
              onPress={() => cart.setQuantity(l.menuItemId, l.quantity - 1)}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text variant="h3">−</Text>
            </Pressable>
            <Text variant="body" style={{ minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{l.quantity}</Text>
            <Pressable
              testID={`qty-inc-${l.menuItemId}`}
              onPress={() => cart.setQuantity(l.menuItemId, l.quantity + 1)}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: p.radius.md, backgroundColor: tokens.brandSolid, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text variant="h3" color="onBrand">+</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ gap: p.space.sm, marginTop: p.space.md }}>
          <Row label={t('customer.cart.foodTotal')} value={formatBaht(totals.foodTotal)} />
          <Row label={t('customer.cart.deliveryFee')} value={formatBaht(totals.deliveryFee)} />
          <Row label={t('customer.cart.serviceFee')} value={formatBaht(totals.serviceFee)} />
          <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginVertical: p.space.xs }} />
          <Row label={t('customer.cart.grandTotal')} value={formatBaht(totals.grandTotal)} bold />
        </View>

        <Button testID="btn-place-order" label={t('customer.cart.placeOrder')} onPress={() => navigation.navigate('Checkout')} />
      </ScrollView>
    </SafeAreaView>
  );
}
