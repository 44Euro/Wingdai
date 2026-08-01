import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { RiderHomeScreen } from '../../features/rider/screens/RiderHomeScreen';
import { RiderJobScreen } from '../../features/rider/screens/RiderJobScreen';
import { RiderEarningsScreen } from '../../features/rider/screens/RiderEarningsScreen';

export type RiderStackParamList = {
  RiderHome: undefined;
  RiderJob: { orderId: string };
  /** R4 + R6 รวมกัน — รายได้กับรายการงานที่ส่งสำเร็จเป็นข้อมูลชุดเดียวกัน */
  RiderEarnings: undefined;
};

const Stack = createNativeStackNavigator<RiderStackParamList>();

export function RiderStack() {
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bgSurface } }}
    >
      <Stack.Screen name="RiderHome" component={RiderHomeScreen} />
      <Stack.Screen name="RiderJob" component={RiderJobScreen} />
      <Stack.Screen name="RiderEarnings" component={RiderEarningsScreen} />
    </Stack.Navigator>
  );
}
