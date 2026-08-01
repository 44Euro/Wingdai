import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { PendingApprovalScreen } from './AuthStack';
import { RiderApplicationScreen } from '../../features/rider/screens/RiderApplicationScreen';

/**
 * เส้นทางของไรเดอร์ที่ยัง **ไม่ผ่านการอนุมัติ** (claude.md §4.3)
 *
 * เดิม RootNavigator เรนเดอร์ PendingApprovalScreen ตรง ๆ โดยไม่มี navigator ครอบ
 * ซึ่งแปลว่าคนที่สมัครบัญชี rider ไปไหนไม่ได้เลยนอกจากออกจากระบบ — และไม่มีทางส่งใบสมัคร
 * ให้แอดมินตรวจ การอนุมัติจึงไม่มีวันเกิดขึ้น
 *
 * §4.3 ยังคงเดิม: บัญชีที่รออนุมัติเข้า stack อื่นไม่ได้ รวมถึงสั่งอาหารเป็นลูกค้าไม่ได้
 * ที่เพิ่มมาคือทางไปกรอกใบสมัครเท่านั้น
 */
export type RiderOnboardingParamList = {
  PendingApproval: undefined;
  RiderApplication: undefined;
};

const Stack = createNativeStackNavigator<RiderOnboardingParamList>();

export function RiderOnboardingStack() {
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bgSurface } }}
    >
      <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      <Stack.Screen name="RiderApplication" component={RiderApplicationScreen} />
    </Stack.Navigator>
  );
}
