import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { SuperAdminTabBar } from './SuperAdminTabBar';
import { SuperHomeScreen } from '../../features/super/screens/SuperHomeScreen';
import { SuperZonesScreen } from '../../features/super/screens/SuperZonesScreen';
import { SuperConfigScreen } from '../../features/super/screens/SuperConfigScreen';
import { SuperAuditScreen } from '../../features/super/screens/SuperAuditScreen';
import { SuperRolesScreen } from '../../features/super/screens/SuperRolesScreen';

/** จอของซูเปอร์แอดมิน (design SA1–SA6 สเปคคลื่น 2 §3.2) */
export type SuperTabParamList = {
  SuperHome: undefined;
  SuperZones: undefined;
  SuperConfig: undefined;
  SuperAudit: undefined;
};

export type SuperStackParamList = {
  Tabs: NavigatorScreenParams<SuperTabParamList> | undefined;
  /** SA3 ทำนาน ๆ ครั้ง จึงเข้าจาก SA1 ไม่ใช่กินที่แท็บ */
  SuperRoles: undefined;
};

const Tab = createBottomTabNavigator<SuperTabParamList>();

function SuperTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={(props) => <SuperAdminTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="SuperHome"
        component={SuperHomeScreen}
        options={{ title: t('super.tabs.home') }}
      />
      <Tab.Screen
        name="SuperZones"
        component={SuperZonesScreen}
        options={{ title: t('super.tabs.zones') }}
      />
      <Tab.Screen
        name="SuperConfig"
        component={SuperConfigScreen}
        options={{ title: t('super.tabs.config') }}
      />
      <Tab.Screen
        name="SuperAudit"
        component={SuperAuditScreen}
        options={{ title: t('super.tabs.audit') }}
      />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator<SuperStackParamList>();

export function SuperAdminStack() {
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bgSurface } }}
    >
      <Stack.Screen name="Tabs" component={SuperTabs} />
      <Stack.Screen name="SuperRoles" component={SuperRolesScreen} />
    </Stack.Navigator>
  );
}
