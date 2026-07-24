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
import { FiltersScreen } from '../../features/customer/screens/FiltersScreen';
import { AddressesScreen } from '../../features/customer/screens/AddressesScreen';
import { AddAddressScreen } from '../../features/customer/screens/AddAddressScreen';
import { OpenRestaurantScreen } from '../../features/merchant/screens/OpenRestaurantScreen';
import { EditProfileScreen } from '../../features/customer/screens/EditProfileScreen';
import { SettingsScreen } from '../../features/customer/screens/SettingsScreen';
import { ReportProblemScreen } from '../../features/customer/screens/ReportProblemScreen';
import { ReceiptScreen } from '../../features/customer/screens/ReceiptScreen';
import { PaymentMethodScreen } from '../../features/customer/screens/PaymentMethodScreen';
import { PromptPayScreen } from '../../features/customer/screens/PromptPayScreen';
import { CardPayScreen } from '../../features/customer/screens/CardPayScreen';
import { SupportScreen } from '../../features/customer/screens/SupportScreen';
import { SupportTicketScreen } from '../../features/customer/screens/SupportTicketScreen';
import { RateOrderScreen } from '../../features/customer/screens/RateOrderScreen';
import { RestaurantReviewsScreen } from '../../features/customer/screens/RestaurantReviewsScreen';
import { OrderChatRoute } from '../../features/customer/OrderChatRoute';
import type { ChatChannel } from '../../data/types';

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
  PaymentMethod: undefined;
  /** ไม่ส่ง orderId = จ่ายตะกร้าที่กำลังสั่ง */
  PromptPay: { orderId?: string } | undefined;
  /** จ่ายด้วยบัตร ใช้ตะกร้าปัจจุบันเสมอ ไม่มีโหมดจ่ายออร์เดอร์เก่าแบบพร้อมเพย์ */
  CardPay: undefined;
  OrderPlaced: { orderId: string };
  /** design ไม่มีแท็บแจ้งเตือน เข้าจากกระดิ่งบนหัวจอ Home แทน (C20) */
  Notifications: undefined;
  OrderTracking: { orderId: string };
  /** แจ้งปัญหาออร์เดอร์ที่ส่งถึงแล้ว (§6.4) เข้าจากใบเสร็จ */
  ReportProblem: { orderId: string };
  /** §4.3 ร้านเป็นความสามารถบนบัญชีเดิม จอนี้จึงอยู่ใน stack ลูกค้า ไม่ใช่ stack แยก */
  OpenRestaurant: undefined;
  /** C21 แก้ชื่อ/อีเมล เบอร์กับ username แก้ที่นี่ไม่ได้ */
  EditProfile: undefined;
  /** C12 SY5 ภาษาและธีม เลือกเองได้ ไม่ใช่ตามอุปกรณ์อย่างเดียว */
  Settings: undefined;
  Search: undefined;
  /** C9 ที่อยู่จัดส่งที่บันทึกไว้ */
  Addresses: undefined;
  /** C29 เพิ่มที่อยู่ */
  AddAddress: undefined;
  /** C14 ใบเสร็จของออร์เดอร์ที่จบแล้ว */
  Receipt: { orderId: string };
  /** AD4 ฝั่งลูกค้า ตั๋วซัพพอร์ต */
  Support: { orderId?: string } | undefined;
  SupportTicket: { ticketId: string };
  /** C11 ให้คะแนนออร์เดอร์ที่ส่งถึงแล้ว เข้าจากใบเสร็จ ซึ่งเป็นจุดเดียวที่รู้ว่ารีวิวมื้อไหน */
  RateOrder: { orderId: string };
  /** C36 รีวิวของร้าน อ่านได้โดยไม่ต้องเคยสั่ง */
  RestaurantReviews: { restaurantId: string };
  Filters: undefined;
  /** C10 แชท `channel` บอกว่ากำลังคุยกับไรเดอร์หรือกับร้าน คนละห้องกัน */
  OrderChat: { orderId: string; channel: ChatChannel };
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();

function CustomerTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      // แถบพิลลอยตาม design วาดเองทั้งแถบ ไม่ใช้ tab bar มาตรฐาน
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
    // design วาดหัวจอเองในแต่ละหน้า (ปุ่มย้อนกลับสี่เหลี่ยมมนบนพื้นครีม) ปิด header ของ navigator
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
      <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
      <Stack.Screen name="PromptPay" component={PromptPayScreen} />
      <Stack.Screen name="CardPay" component={CardPayScreen} />
      <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      {/* C2 เปิดจากแถบค้นหาบนหน้าแรก ไม่มีแอนิเมชันสไลด์เพื่อให้รู้สึกเหมือนช่องค้นหาขยายขึ้นมา */}
      <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Filters" component={FiltersScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
      <Stack.Screen name="ReportProblem" component={ReportProblemScreen} />
      <Stack.Screen name="OpenRestaurant" component={OpenRestaurantScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="SupportTicket" component={SupportTicketScreen} />
      <Stack.Screen name="RateOrder" component={RateOrderScreen} />
      <Stack.Screen name="RestaurantReviews" component={RestaurantReviewsScreen} />
      <Stack.Screen name="OrderChat" component={OrderChatRoute} />
    </Stack.Navigator>
  );
}
