import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { LoginScreen } from './AuthStack';
import { RegisterScreen } from './RegisterScreen';
import type { RegisterFormValues } from './RegisterScreen';

/**
 * Param list เต็มของ auth flow (5 หน้าตามแผน) — รอบนี้สร้างจริงแค่ Login/Register
 * อีก 3 หน้า (OtpVerify, ChooseAccountType, ForgotPassword) ยังไม่มีไฟล์คอมโพเนนต์
 * (task ถัดไปทำ) ประกาศ key ของ param list ไว้ก่อนเพื่อให้ navigation.navigate(...)
 * ที่เรียกจาก Login/Register อยู่แล้วตอนนี้ type-check ผ่าน — เมื่อสร้างหน้าจริง
 * ในงานถัดไป แค่เพิ่ม <Stack.Screen> ในไฟล์นี้ ไม่ต้องแก้ type ตรงนี้อีก
 */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OtpVerify: { form: RegisterFormValues };
  ChooseAccountType: undefined;
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: { backgroundColor: tokens.bgSurface },
        headerTintColor: tokens.textPrimary,
        headerTitleStyle: { color: tokens.textPrimary },
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: t('auth.login.title') }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: t('auth.register.title') }}
      />
    </Stack.Navigator>
  );
}
