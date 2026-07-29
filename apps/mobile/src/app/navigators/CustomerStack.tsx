import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { WingdaiTabBar } from './WingdaiTabBar';
import { CustomerHomeScreen } from '../../features/customer/screens/CustomerHomeScreen';
import { OrderHistoryScreen } from '../../features/customer/screens/OrderHistoryScreen';
import { NotificationsScreen } from '../../features/customer/screens/NotificationsScreen';
import { CategoriesScreen } from '../../features/customer/screens/CategoriesScreen';
import { OrderTrackingScreen } from '../../features/customer/screens/OrderTrackingScreen';
import { ProfileScreen } from '../../features/customer/screens/ProfileScreen';
import { RestaurantDetailScreen } from '../../features/customer/screens/RestaurantDetailScreen';
import { MenuItemScreen } from '../../features/customer/screens/MenuItemScreen';
import { CartScreen } from '../../features/customer/screens/CartScreen';
import { CheckoutScreen } from '../../features/customer/screens/CheckoutScreen';
import { OrderPlacedScreen } from '../../features/customer/screens/OrderPlacedScreen';
import { SearchScreen } from '../../features/customer/screens/SearchScreen';

export type CustomerTabParamList = {
  CustomerHome: undefined;
  Categories: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type CustomerStackParamList = {
  Tabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  RestaurantDetail: { restaurantId: string };
  MenuItem: { restaurantId: string; menuItemId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderPlaced: { orderId: string };
  /** design ไม่มีแท็บแจ้งเตือน — เข้าจากกระดิ่งบนหัวจอ Home แทน (C20) */
  Notifications: undefined;
  OrderTracking: { orderId: string };
  Search: undefined;
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();

function CustomerTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      // แถบพิลลอยตาม design — วาดเองทั้งแถบ ไม่ใช้ tab bar มาตรฐาน
      tabBar={(props) => <WingdaiTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="CustomerHome" component={CustomerHomeScreen} options={{ title: t('customer.tabs.home') }} />
      <Tab.Screen name="Categories" component={CategoriesScreen} options={{ title: t('customer.tabs.menu') }} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} options={{ title: t('customer.tabs.orders') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('customer.tabs.profile') }} />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export function CustomerStack() {
  const { tokens } = useTheme();
  return (
    // design วาดหัวจอเองในแต่ละหน้า (ปุ่มย้อนกลับสี่เหลี่ยมมนบนพื้นครีม) — ปิด header ของ navigator
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bgSurface },
      }}
    >
      {/* flow สั่งอาหาร push เหนือ Tabs → tab bar หายตอน drill-down */}
      <Stack.Screen name="Tabs" component={CustomerTabs} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} />
      <Stack.Screen name="MenuItem" component={MenuItemScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      {/* C2 เปิดจากแถบค้นหาบนหน้าแรก — ไม่มีแอนิเมชันสไลด์เพื่อให้รู้สึกเหมือนช่องค้นหาขยายขึ้นมา */}
      <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}
