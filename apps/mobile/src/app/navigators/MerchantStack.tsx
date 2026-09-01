import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { MerchantTabBar } from './MerchantTabBar';
import { MerchantOrdersScreen } from '../../features/merchant/screens/MerchantOrdersScreen';
import { MerchantProfileScreen } from '../../features/merchant/screens/MerchantProfileScreen';
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

/** สี่แท็บของฝั่งร้าน คิว เมนู ยอดขาย และร้านของฉัน */
export type MerchantTabParamList = {
  MerchantOrders: undefined;
  MerchantMenu: undefined;
  /** M1 + M5 รวมกัน ยอดขายกับยอดที่จะได้รับเป็นตัวเลขชุดเดียวกัน */
  MerchantSummary: undefined;
  /** ที่เดียวที่สลับโหมดและออกจากระบบได้ ทุกบทบาทมีแท็บนี้ */
  MerchantProfile: undefined;
};

export type MerchantStackParamList = {
  Tabs: NavigatorScreenParams<MerchantTabParamList> | undefined;
  MerchantOrderDetail: { orderId: string };
  AddMenuItem: { restaurantId: string };
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

const Tab = createBottomTabNavigator<MerchantTabParamList>();

function MerchantTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={(props) => <MerchantTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* คิวออเดอร์เป็นแท็บแรก ไม่ใช่จอเมนู ร้านเปิดแอปเพราะมีออเดอร์เข้า */}
      <Tab.Screen name="MerchantOrders" component={MerchantOrdersScreen} options={{ title: t('merchant.tabs.orders') }} />
      <Tab.Screen name="MerchantMenu" component={MerchantMenuScreen} options={{ title: t('merchant.tabs.menu') }} />
      <Tab.Screen name="MerchantSummary" component={MerchantSummaryScreen} options={{ title: t('merchant.tabs.summary') }} />
      <Tab.Screen name="MerchantProfile" component={MerchantProfileScreen} options={{ title: t('merchant.tabs.profile') }} />
    </Tab.Navigator>
  );
}

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
      <Stack.Screen name="Tabs" component={MerchantTabs} />
      <Stack.Screen name="MerchantOrderDetail" component={MerchantOrderDetailScreen} />
      <Stack.Screen name="AddMenuItem" component={AddMenuItemScreen} />
      <Stack.Screen name="MerchantReviews" component={MerchantReviewsScreen} />
      <Stack.Screen name="MerchantChat" component={MerchantChatRoute} />
      <Stack.Screen name="MerchantQr" component={MerchantQrScreen} />
      <Stack.Screen name="MerchantHours" component={MerchantHoursScreen} />
      <Stack.Screen name="RejectOrder" component={RejectOrderScreen} />
      <Stack.Screen name="EditMenuItem" component={EditMenuItemScreen} />
    </Stack.Navigator>
  );
}
