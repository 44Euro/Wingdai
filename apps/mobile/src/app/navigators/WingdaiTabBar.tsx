import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Icon, IconName } from '../../ui/Icon';
import { useCartStore } from '../../features/cart/cartStore';
import { useActiveOrder } from '../../features/customer/hooks';

const ICONS: Record<string, IconName> = {
  CustomerHome: 'home',
  Categories: 'menu',
  Orders: 'history',
  Profile: 'user',
};

/** ความสูงที่จอในแท็บต้องเว้นไว้ล่างสุด */
export const TAB_BAR_CLEARANCE = 132;

/** แถบนำทางทรงพิลลอยตาม Wingdai design system */
export function WingdaiTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { tokens, primitives: p, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  const cartCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const activeOrder = useActiveOrder();

  const routes = state.routes;
  const mid = Math.ceil(routes.length / 2);
  const barBottom = Math.max(insets.bottom, p.space.lg);

  const renderTab = (route: (typeof routes)[number], index: number) => {
    const focused = state.index === index;
    const { options } = descriptors[route.key];
    const label = typeof options.title === 'string' ? options.title : route.name;

    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={({ pressed }) => ({
          width: 60,
          alignItems: 'center',
          gap: 3,
          transform: [{ scale: pressed ? 0.86 : 1 }],
        })}
      >
        <View
          style={{
            width: 44,
            height: 34,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            // โหมดสว่าง: แผ่นส้มรองไอคอน (ไม่มีตัวหนังสือทับ จึงใช้ brandAccent ได้)
            backgroundColor: focused && !isDark ? tokens.brandAccent : 'transparent',
          }}
        >
          <Icon
            name={ICONS[route.name] ?? 'home'}
            color={focused ? tokens.navActive : tokens.navIdle}
            size={21}
          />
        </View>
        <Text
          variant="kicker"
          numberOfLines={1}
          style={{
            letterSpacing: 0,
            color: focused ? tokens.navActive : tokens.navIdle,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      {/* ปุ่มตะกร้า ลอยมุมขวาเหนือแถบ โผล่เฉพาะตอนมีของ */}
      {cartCount > 0 ? (
        <Pressable
          testID="tab-cart"
          accessibilityRole="button"
          accessibilityLabel={t('customer.cart.title')}
          onPress={() => navigation.getParent()?.navigate('Cart')}
          style={({ pressed }) => [
            {
              position: 'absolute',
              right: p.space.lg,
              bottom: barBottom + 70 + p.space.md,
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: tokens.brandAccent,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.9 : 1 }],
            },
            p.shadow.brand,
          ]}
        >
          <Icon name="cart" color={tokens.textOnBrand} size={24} strokeWidth={2.2} />
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 24,
              height: 24,
              paddingHorizontal: 6,
              borderRadius: 12,
              // C32: ตัวนับเป็นวงพื้นเข้มเท่าพื้นแอป ตัวขาว ขอบส้ม
              backgroundColor: tokens.bgSurface,
              borderWidth: 2.5,
              borderColor: tokens.brandAccent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text testID="tab-cart-count" variant="kicker" bold style={{ letterSpacing: 0 }}>
              {cartCount}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View
        style={[
          {
            position: 'absolute',
            left: p.space.lg,
            right: p.space.lg,
            bottom: barBottom,
            height: 70,
            backgroundColor: tokens.navSurface,
            borderRadius: p.radius.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: p.space.sm,
          },
          // เงา teal ใต้แถบดำในโหมดมืดจะเห็นเป็นคราบเขียว C32 ใช้เงาดำล้วน
          isDark ? p.shadow.navDark : p.shadow.teal,
        ]}
      >
        {routes.slice(0, mid).map((r, i) => renderTab(r, i))}
        {/* เว้นช่องกลางเฉพาะตอนที่ปุ่มออเดอร์โผล่ ไม่งั้นแท็บจะเบี้ยวโดยไม่จำเป็น */}
        {activeOrder ? <View style={{ width: 54 }} /> : null}
        {routes.slice(mid).map((r, i) => renderTab(r, i + mid))}

        {/* ปุ่มออเดอร์ คร่อมขอบบนแถบ โผล่เฉพาะตอนมีออเดอร์ที่ยังไม่จบ */}
        {activeOrder ? (
          <Pressable
            testID="tab-order"
            accessibilityRole="button"
            accessibilityLabel={t('customer.tracking.title')}
            onPress={() =>
              navigation.getParent()?.navigate('OrderTracking', { orderId: activeOrder.id })
            }
            style={({ pressed }) => [
              {
                position: 'absolute',
                alignSelf: 'center',
                bottom: 34,
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: tokens.brandAccent,
                // ขอบเป็นสีพื้นแอป ทำให้ปุ่มดูเจาะทะลุแถบออกมา
                borderWidth: 5,
                borderColor: tokens.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.9 : 1 }],
              },
              p.shadow.brand,
            ]}
          >
            <Icon name="burger" color={tokens.textOnBrand} size={26} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
