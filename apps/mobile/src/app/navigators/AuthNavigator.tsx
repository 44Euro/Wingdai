import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { LoginScreen } from './AuthStack';
import { RegisterScreen } from './RegisterScreen';
import type { RegisterFormValues } from './RegisterScreen';
import { OtpVerifyScreen } from './OtpVerifyScreen';
import { ChooseAccountTypeScreen } from './ChooseAccountTypeScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

/**
 * Param list เต็มของ auth flow (5 หน้าตามแผน) — Login/Register/OtpVerify/ChooseAccountType
 * สร้างจริงครบแล้ว เหลือ ForgotPassword ยังไม่มีไฟล์คอมโพเนนต์ (task ถัดไปทำ) ประกาศ key
 * ของ param list ไว้ก่อนเพื่อให้ navigation.navigate(...) ที่เรียกจาก Login อยู่แล้วตอนนี้
 * type-check ผ่าน — เมื่อสร้างหน้าจริงในงานถัดไป แค่เพิ่ม <Stack.Screen> ในไฟล์นี้ ไม่ต้องแก้
 * type ตรงนี้อีก
 */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OtpVerify: { form: RegisterFormValues };
  ChooseAccountType: { form: RegisterFormValues };
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { tokens } = useTheme();

  return (
    // design วาดหัวจอเองในแต่ละหน้า — ปิด header ของ navigator
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bgSurface },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="ChooseAccountType" component={ChooseAccountTypeScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
