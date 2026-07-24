import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { MerchantOrdersScreen } from '../../features/merchant/screens/MerchantOrdersScreen';
import { MerchantOrderDetailScreen } from '../../features/merchant/screens/MerchantOrderDetailScreen';
import { MerchantMenuScreen } from '../../features/merchant/screens/MerchantMenuScreen';
import { AddMenuItemScreen } from '../../features/merchant/screens/AddMenuItemScreen';
import { MerchantSummaryScreen } from '../../features/merchant/screens/MerchantSummaryScreen';
import { MerchantReviewsScreen } from '../../features/merchant/screens/MerchantReviewsScreen';
import { MerchantChatRoute } from '../../features/merchant/MerchantChatRoute';
import { MerchantQrScreen } from '../../features/merchant/screens/MerchantQrScreen';
import { MerchantHoursScreen } from '../../features/merchant/screens/MerchantHoursScreen';
import { RejectOrderScreen } from '../../features/merchant/screens/RejectOrderScreen';
import { EditMenuItemScreen } from '../../features/merchant/screens/EditMenuItemScreen';

export type MerchantStackParamList = {
  MerchantOrders: undefined;
  MerchantOrderDetail: { orderId: string };
  MerchantMenu: undefined;
  AddMenuItem: { restaurantId: string };
  /** M1 + M5 รวมกัน ยอดขายกับยอดที่จะได้รับเป็นตัวเลขชุดเดียวกัน */
  MerchantSummary: undefined;
  /** M9 รีวิวที่ร้านได้รับ อ่านอย่างเดียว ตอบกลับหรือขอลบไม่ได้ */
  MerchantReviews: { restaurantId: string };
  /** M10 ร้านคุยกับลูกค้า ร้านเข้าได้ช่องนี้ช่องเดียว */
  MerchantChat: { orderId: string };
  /** QR + ลิงก์ของร้าน ทางดึงลูกค้าตอนที่ไม่มีเว็บสั่งอาหาร (§4.3 §11 ข้อ 1) */
  MerchantQr: { restaurantId: string };
  MerchantHours: { restaurantId: string };
  RejectOrder: { orderId: string };
  EditMenuItem: { restaurantId: string; menuItemId: string };
};

const Stack = createNativeStackNavigator<MerchantStackParamList>();

export function MerchantStack() {
  const { tokens } = useTheme();
  return (
    // design วาดหัวจอเองในแต่ละหน้า ปิด header ของ navigator
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bgSurface },
      }}
    >
      {/* คิวออร์เดอร์เป็นจอแรก ไม่ใช่จอเมนู ร้านเปิดแอปเพราะมีออร์เดอร์เข้า */}
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersScreen} />
      <Stack.Screen name="MerchantOrderDetail" component={MerchantOrderDetailScreen} />
      <Stack.Screen name="MerchantMenu" component={MerchantMenuScreen} />
      <Stack.Screen name="AddMenuItem" component={AddMenuItemScreen} />
      <Stack.Screen name="MerchantSummary" component={MerchantSummaryScreen} />
      <Stack.Screen name="MerchantReviews" component={MerchantReviewsScreen} />
      <Stack.Screen name="MerchantChat" component={MerchantChatRoute} />
      <Stack.Screen name="MerchantQr" component={MerchantQrScreen} />
      <Stack.Screen name="MerchantHours" component={MerchantHoursScreen} />
      <Stack.Screen name="RejectOrder" component={RejectOrderScreen} />
      <Stack.Screen name="EditMenuItem" component={EditMenuItemScreen} />
    </Stack.Navigator>
  );
}
