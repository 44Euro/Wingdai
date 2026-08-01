import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { PendingApprovalScreen } from './AuthStack';
import { RiderApplicationScreen } from '../../features/rider/screens/RiderApplicationScreen';

/** เส้นทางของไรเดอร์ที่ยัง ไม่ผ่านการอนุมัติ (product-spec §4.3) */
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
