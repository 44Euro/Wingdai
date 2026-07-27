import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { MerchantMenuScreen } from '../../features/merchant/screens/MerchantMenuScreen';
import { AddMenuItemScreen } from '../../features/merchant/screens/AddMenuItemScreen';

export type MerchantStackParamList = {
  MerchantMenu: undefined;
  AddMenuItem: { restaurantId: string };
};

const Stack = createNativeStackNavigator<MerchantStackParamList>();

export function MerchantStack() {
  const { tokens } = useTheme();
  return (
    // design วาดหัวจอเองในแต่ละหน้า — ปิด header ของ navigator
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bgSurface },
      }}
    >
      <Stack.Screen name="MerchantMenu" component={MerchantMenuScreen} />
      <Stack.Screen name="AddMenuItem" component={AddMenuItemScreen} />
    </Stack.Navigator>
  );
}
