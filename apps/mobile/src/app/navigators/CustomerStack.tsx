import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { CustomerHomeScreen } from '../../features/customer/screens/CustomerHomeScreen';
import { RestaurantDetailScreen } from '../../features/customer/screens/RestaurantDetailScreen';
import { CartScreen } from '../../features/customer/screens/CartScreen';
import { CheckoutScreen } from '../../features/customer/screens/CheckoutScreen';
import { OrderPlacedScreen } from '../../features/customer/screens/OrderPlacedScreen';

export type CustomerStackParamList = {
  CustomerHome: undefined;
  RestaurantDetail: { restaurantId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderPlaced: { orderId: string };
};

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
      <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={{ title: t('customer.restaurant.menu') }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: t('customer.cart.title') }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: t('customer.checkout.title') }} />
      <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} options={{ headerShown: false, gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
