import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Icon, IconName } from '../../ui/Icon';
import { PressScale } from '../../ui/motion';

/** ความสูงที่จอในแท็บต้องเว้นไว้ล่างสุด ไม่งั้นบรรทัดท้ายโดนแถบบัง */
export const PILL_TAB_CLEARANCE = 104;

/** แถบนำทางทรงพิลลอยของฝั่งทำงาน (แอดมิน ซูเปอร์แอดมิน) */
export function PillTabBar({
  state,
  descriptors,
  navigation,
  prefix,
  icons,
}: BottomTabBarProps & { prefix: string; icons: Record<string, IconName> }) {
  const { tokens, primitives: p, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={`${prefix}-tab-bar`}
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
          paddingHorizontal: p.space.xs,
        },
        isDark ? p.shadow.navDark : p.shadow.teal,
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;

        return (
          <PressScale
            key={route.key}
            testID={`${prefix}-tab-${route.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress', target: route.key, canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center' }}
          >
            <View style={{ alignItems: 'center', gap: 3 }}>
              {/* แผ่นรองสีส้มมีเฉพาะโหมดสว่าง โหมดมืดใช้สีไอคอนบอกว่าเลือกอยู่แทน */}
              <View
                style={{
                  width: 40,
                  height: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused && !isDark ? tokens.brandAccent : 'transparent',
                }}
              >
                <Icon
                  name={icons[route.name] ?? 'home'}
                  color={focused ? tokens.navActive : tokens.navIdle}
                  size={20}
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
