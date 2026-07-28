import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Icon, IconName } from '../../ui/Icon';
import { useCartStore } from '../../features/cart/cartStore';

const ICONS: Record<string, IconName> = {
  CustomerHome: 'home',
  Orders: 'history',
  Inbox: 'inbox',
  Profile: 'user',
};

/** ความสูงที่จอในแท็บต้องเว้นไว้ล่างสุด ไม่งั้นเนื้อหาจะโดนแถบลอยทับ */
export const TAB_BAR_CLEARANCE = 104;

/**
 * แถบนำทางทรงพิลลอยตาม Wingdai design system
 * พื้น teal มุม 24 เงานุ่ม · ตัวที่เลือกมีแผ่นส้มมนรองไอคอน · ปุ่มตะกร้าวงกลมกลางแถบ
 */
export function WingdaiTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { tokens, primitives: p, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const cartCount = lines.reduce((n, l) => n + l.quantity, 0);

  const routes = state.routes;
  const mid = Math.ceil(routes.length / 2);

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
            // โหมดมืด (C32): ไม่มีแผ่นรอง ไอคอนเป็นสีส้มเอง
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
    <View
      style={[
        {
          position: 'absolute',
          left: p.space.lg,
          right: p.space.lg,
          bottom: Math.max(insets.bottom, p.space.lg),
          height: 70,
          backgroundColor: tokens.navSurface,
          borderRadius: p.radius.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: p.space.sm,
        },
        // เงา teal ใต้แถบดำในโหมดมืดจะเห็นเป็นคราบเขียว — C32 ใช้เงาดำล้วน
        isDark ? { ...p.shadow.teal, shadowColor: '#000000', shadowOpacity: 0.5 } : p.shadow.teal,
      ]}
    >
      {routes.slice(0, mid).map((r, i) => renderTab(r, i))}
      <View style={{ width: 54 }} />
      {routes.slice(mid).map((r, i) => renderTab(r, i + mid))}

      {/* ปุ่มตะกร้ากลางแถบ — ตะกร้าอยู่บน stack แม่ ไม่ใช่แท็บ */}
      <Pressable
        testID="tab-cart"
        accessibilityRole="button"
        accessibilityLabel="ตะกร้า"
        onPress={() => navigation.getParent()?.navigate('Cart')}
        style={({ pressed }) => [
          {
            position: 'absolute',
            alignSelf: 'center',
            bottom: 34,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: tokens.brandAccent,
            borderWidth: 4,
            borderColor: tokens.bgSurface,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.9 : 1 }],
          },
          p.shadow.brand,
        ]}
      >
        <Icon name="cart" color="#FFFFFF" size={24} strokeWidth={2.2} />
        {cartCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 5,
              borderRadius: 11,
              backgroundColor: tokens.tealSolid,
              borderWidth: 2,
              borderColor: tokens.bgSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="kicker" style={{ letterSpacing: 0, color: '#FFFFFF' }}>
              {cartCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
