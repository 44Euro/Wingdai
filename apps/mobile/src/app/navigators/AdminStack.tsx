import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { AdminTabBar } from './AdminTabBar';
import { AdminHomeScreen } from '../../features/admin/screens/AdminHomeScreen';
import { AdminOrdersScreen } from '../../features/admin/screens/AdminOrdersScreen';
import { AdminMoneyScreen } from '../../features/admin/screens/AdminMoneyScreen';
import { AdminApproveScreen } from '../../features/admin/screens/AdminApproveScreen';
import { AdminMapScreen } from '../../features/admin/screens/AdminMapScreen';
import { AdminRiderDocsScreen } from '../../features/admin/screens/AdminRiderDocsScreen';
import { AdminSupportScreen } from '../../features/admin/screens/AdminSupportScreen';
import { AdminTicketScreen } from '../../features/admin/screens/AdminTicketScreen';
import { SettingsScreen } from '../../features/customer/screens/SettingsScreen';

/** แท็บของแอดมิน */
export type AdminTabParamList = {
  AdminHome: undefined;
  AdminOrders: undefined;
  AdminMoney: undefined;
  AdminApprove: undefined;
  /** AD4 คิวตั๋วซัพพอร์ต */
  AdminSupport: undefined;
};

export type AdminStackParamList = {
  /** ภาษาและธีม ต้องเข้าถึงได้จากทุกบทบาท ไม่ใช่เฉพาะฝั่งลูกค้า */
  Settings: undefined;
  Tabs: NavigatorScreenParams<AdminTabParamList> | undefined;
  /** AD8 แผนที่ ops push ทับแท็บเพราะเป็นจอเต็มที่ต้องการพื้นที่ทั้งหมด */
  AdminMap: undefined;
  /** AD6 รูปเอกสาร KYC เต็มจอ ของไรเดอร์คนเดียว */
  AdminRiderDocs: { accountId: string; name: string };
  /** AD4 เธรดตั๋วใบเดียว */
  AdminTicket: { ticketId: string };
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

function AdminTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={(props) => <AdminTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="AdminHome"
        component={AdminHomeScreen}
        options={{ title: t('admin.tabs.home') }}
      />
      <Tab.Screen
        name="AdminOrders"
        component={AdminOrdersScreen}
        options={{ title: t('admin.tabs.orders') }}
      />
      <Tab.Screen
        name="AdminMoney"
        component={AdminMoneyScreen}
        options={{ title: t('admin.tabs.money') }}
      />
      <Tab.Screen
        name="AdminApprove"
        component={AdminApproveScreen}
        options={{ title: t('admin.tabs.approve') }}
      />
      <Tab.Screen
        name="AdminSupport"
        component={AdminSupportScreen}
        options={{ title: t('admin.tabs.support') }}
      />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminStack() {
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bgSurface } }}
    >
      <Stack.Screen name="Tabs" component={AdminTabs} />
      <Stack.Screen name="AdminMap" component={AdminMapScreen} />
      <Stack.Screen name="AdminRiderDocs" component={AdminRiderDocsScreen} />
      <Stack.Screen name="AdminTicket" component={AdminTicketScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
