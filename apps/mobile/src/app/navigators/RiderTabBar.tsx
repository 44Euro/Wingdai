import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Icon, IconName } from '../../ui/Icon';
import { PressScale } from '../../ui/motion';

const ICONS: Record<string, IconName> = {
  RiderHome: 'home',
  RiderEarnings: 'history',
  RiderPayout: 'card',
  RiderProfile: 'user',
};

/** ความสูงที่จอในแท็บต้องเว้นไว้ล่างสุด ไม่งั้นบรรทัดท้ายโดนแถบบัง */
export const RIDER_TAB_CLEARANCE = 104;

/** แถบนำทางของไรเดอร์ ทรงพิลลอยเดียวกับฝั่งลูกค้า (Wingdai design system) */
export function RiderTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { tokens, primitives: p, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

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
        // เงา teal ใต้แถบดำในโหมดมืดจะเห็นเป็นคราบเขียว ใช้เงาดำล้วนแทน
        isDark ? { ...p.shadow.teal, shadowColor: '#000000', shadowOpacity: 0.5 } : p.shadow.teal,
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;

        return (
          <PressScale
            key={route.key}
            testID={`rider-tab-${route.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress', target: route.key, canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ width: 68, alignItems: 'center' }}
          >
            <View style={{ alignItems: 'center', gap: 3 }}>
              <View
                style={{
                  width: 44,
                  height: 34,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  // โหมดสว่าง: แผ่นส้มรองไอคอน โหมดมืด: ไม่มีแผ่นรอง ไอคอนเป็นสีส้มเอง
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
                style={{ letterSpacing: 0, color: focused ? tokens.navActive : tokens.navIdle }}
              >
                {label}
              </Text>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}
