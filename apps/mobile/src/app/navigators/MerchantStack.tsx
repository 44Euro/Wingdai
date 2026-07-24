import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { MerchantMenuScreen } from '../../features/merchant/screens/MerchantMenuScreen';
import { AddMenuItemScreen } from '../../features/merchant/screens/AddMenuItemScreen';

export type MerchantStackParamList = {
  MerchantMenu: undefined;
  AddMenuItem: { restaurantId: string };
};

const Stack = createNativeStackNavigator<MerchantStackParamList>();

export function MerchantStack() {
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
      <Stack.Screen name="MerchantMenu" component={MerchantMenuScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddMenuItem" component={AddMenuItemScreen} options={{ title: t('merchant.form.title') }} />
    </Stack.Navigator>
  );
}
