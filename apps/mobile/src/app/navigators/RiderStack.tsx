import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { RiderTabBar } from './RiderTabBar';
import { RiderHomeScreen } from '../../features/rider/screens/RiderHomeScreen';
import { RiderJobScreen } from '../../features/rider/screens/RiderJobScreen';
import { RiderEarningsScreen } from '../../features/rider/screens/RiderEarningsScreen';
import { RiderPayoutScreen } from '../../features/rider/screens/RiderPayoutScreen';
import { RiderProfileScreen } from '../../features/rider/screens/RiderProfileScreen';
import { RiderPickupScreen } from '../../features/rider/screens/RiderPickupScreen';
import { RiderIssueScreen } from '../../features/rider/screens/RiderIssueScreen';
import { RiderProofScreen } from '../../features/rider/screens/RiderProofScreen';
import { RiderBaseScreen } from '../../features/rider/screens/RiderBaseScreen';
import { RiderDocumentsScreen } from '../../features/rider/screens/RiderDocumentsScreen';
import { RiderChatRoute } from '../../features/rider/RiderChatRoute';
import { SettingsScreen } from '../../features/customer/screens/SettingsScreen';

/** สี่แท็บของไรเดอร์ */
export type RiderTabParamList = {
  RiderHome: undefined;
  RiderEarnings: undefined;
  RiderPayout: undefined;
  RiderProfile: undefined;
};

export type RiderStackParamList = {
  /** ภาษาและธีม ต้องเข้าถึงได้จากทุกบทบาท ไม่ใช่เฉพาะฝั่งลูกค้า */
  Settings: undefined;
  Tabs: NavigatorScreenParams<RiderTabParamList> | undefined;
  RiderJob: { orderId: string };
  /** R10 จุดรับอาหาร: เช็กลิสต์ถุงก่อนออกจากร้าน */
  RiderPickup: { orderId: string };
  /** R9 แจ้งปัญหาระหว่างส่ง เรื่องเข้าคิวแอดมิน ไม่เปลี่ยนสถานะออเดอร์เอง */
  RiderIssue: { orderId: string };
  /** R11 ยืนยันส่งด้วยรหัสจากลูกค้า ปิดงานได้จากจอนี้จอเดียว */
  RiderProof: { orderId: string };
  /** R7 จุดตั้งทำงาน แทนจอโซนเดิมที่หมดความหมายหลังเปลี่ยนเป็นโมเดลระยะ */
  RiderBase: undefined;
  /** R8 เอกสารหกชิ้นที่ §7 บังคับก่อนแอดมินอนุมัติ */
  RiderDocuments: undefined;
  /** คู่ของ C10 ไรเดอร์คุยกับลูกค้าระหว่างส่ง */
  RiderChat: { orderId: string };
  /** ชื่อแท็บซ้ำไว้ในนี้ด้วย เพื่อให้จอที่อยู่ใน stack (เช่น R11) `navigate` กลับไปหาแท็บได้ */
  RiderEarnings: undefined;
  RiderPayout: undefined;
};

const Tab = createBottomTabNavigator<RiderTabParamList>();

function RiderTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={(props) => <RiderTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="RiderHome"
        component={RiderHomeScreen}
        options={{ title: t('rider.tabs.home') }}
      />
      <Tab.Screen
        name="RiderEarnings"
        component={RiderEarningsScreen}
        options={{ title: t('rider.tabs.earnings') }}
      />
      <Tab.Screen
        name="RiderPayout"
        component={RiderPayoutScreen}
        options={{ title: t('rider.tabs.payout') }}
      />
      <Tab.Screen
        name="RiderProfile"
        component={RiderProfileScreen}
        options={{ title: t('rider.tabs.profile') }}
      />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator<RiderStackParamList>();

export function RiderStack() {
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bgSurface } }}
    >
      {/* จอที่ทำงานกับงานหนึ่งใบ push ทับแท็บ → แถบหายตอนกำลังทำงาน ไม่มีอะไรมาดึงความสนใจ */}
      <Stack.Screen name="Tabs" component={RiderTabs} />
      <Stack.Screen name="RiderJob" component={RiderJobScreen} />
      <Stack.Screen name="RiderPickup" component={RiderPickupScreen} />
      <Stack.Screen name="RiderIssue" component={RiderIssueScreen} />
      <Stack.Screen name="RiderProof" component={RiderProofScreen} />
      <Stack.Screen name="RiderBase" component={RiderBaseScreen} />
      <Stack.Screen name="RiderDocuments" component={RiderDocumentsScreen} />

      <Stack.Screen name="RiderChat" component={RiderChatRoute} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
