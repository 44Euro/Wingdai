import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { TabIcon } from '../../ui/TabIcon';
import { CustomerHomeScreen } from '../../features/customer/screens/CustomerHomeScreen';
import { OrderHistoryScreen } from '../../features/customer/screens/OrderHistoryScreen';
import { InboxScreen } from '../../features/customer/screens/InboxScreen';
import { ProfileScreen } from '../../features/customer/screens/ProfileScreen';
import { RestaurantDetailScreen } from '../../features/customer/screens/RestaurantDetailScreen';
import { MenuItemScreen } from '../../features/customer/screens/MenuItemScreen';
import { CartScreen } from '../../features/customer/screens/CartScreen';
import { CheckoutScreen } from '../../features/customer/screens/CheckoutScreen';
import { OrderPlacedScreen } from '../../features/customer/screens/OrderPlacedScreen';

export type CustomerTabParamList = {
  CustomerHome: undefined;
  Orders: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type CustomerStackParamList = {
  Tabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  RestaurantDetail: { restaurantId: string };
  MenuItem: { restaurantId: string; menuItemId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderPlaced: { orderId: string };
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();

function CustomerTabs() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.brandSolid,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarStyle: { backgroundColor: tokens.bgSurface, borderTopColor: tokens.borderSubtle },
      }}
    >
      <Tab.Screen
        name="CustomerHome"
        component={CustomerHomeScreen}
        options={{ title: t('customer.tabs.home'), tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }}
      />
      <Tab.Screen
        name="Orders"
        component={OrderHistoryScreen}
        options={{ title: t('customer.tabs.orders'), tabBarIcon: ({ color }) => <TabIcon name="orders" color={color} /> }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ title: t('customer.tabs.inbox'), tabBarIcon: ({ color }) => <TabIcon name="inbox" color={color} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('customer.tabs.profile'), tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export function CustomerStack() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: tokens.bgSurface },
        headerTintColor: tokens.textPrimary,
        headerTitleStyle: { color: tokens.textPrimary },
      }}
    >
      {/* flow สั่งอาหาร push เหนือ Tabs → tab bar หายตอน drill-down */}
      <Stack.Screen name="Tabs" component={CustomerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={{ title: t('customer.restaurant.menu') }} />
      <Stack.Screen name="MenuItem" component={MenuItemScreen} options={{ title: t('customer.item.customize') }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: t('customer.cart.title') }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: t('customer.checkout.title') }} />
      <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} options={{ headerShown: false, gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
