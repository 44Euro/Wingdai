import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { MerchantOrdersScreen } from '../../features/merchant/screens/MerchantOrdersScreen';
import { MerchantOrderDetailScreen } from '../../features/merchant/screens/MerchantOrderDetailScreen';
import { MerchantMenuScreen } from '../../features/merchant/screens/MerchantMenuScreen';
import { AddMenuItemScreen } from '../../features/merchant/screens/AddMenuItemScreen';
import { MerchantSummaryScreen } from '../../features/merchant/screens/MerchantSummaryScreen';

export type MerchantStackParamList = {
  MerchantOrders: undefined;
  MerchantOrderDetail: { orderId: string };
  MerchantMenu: undefined;
  AddMenuItem: { restaurantId: string };
  /** M1 + M5 รวมกัน — ยอดขายกับยอดที่จะได้รับเป็นตัวเลขชุดเดียวกัน */
  MerchantSummary: undefined;
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
      {/*
        คิวออร์เดอร์เป็นจอแรก ไม่ใช่จอเมนู — ร้านเปิดแอปเพราะมีออร์เดอร์เข้า
        ไม่ใช่เพราะอยากแก้เมนู และ §8 วัดอัตราการรับออร์เดอร์ > 95%
      */}
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersScreen} />
      <Stack.Screen name="MerchantOrderDetail" component={MerchantOrderDetailScreen} />
      <Stack.Screen name="MerchantMenu" component={MerchantMenuScreen} />
      <Stack.Screen name="AddMenuItem" component={AddMenuItemScreen} />
      <Stack.Screen name="MerchantSummary" component={MerchantSummaryScreen} />
    </Stack.Navigator>
  );
}
