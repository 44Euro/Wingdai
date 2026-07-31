import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { RiderHomeScreen } from '../../features/rider/screens/RiderHomeScreen';
import { RiderJobScreen } from '../../features/rider/screens/RiderJobScreen';

export type RiderStackParamList = {
  RiderHome: undefined;
  RiderJob: { orderId: string };
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
    </Stack.Navigator>
  );
}
