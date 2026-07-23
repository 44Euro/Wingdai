import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { LoginScreen } from './AuthStack';
import { RegisterScreen } from './RegisterScreen';
import type { RegisterFormValues } from './RegisterScreen';
import { OtpVerifyScreen } from './OtpVerifyScreen';
import { ChooseAccountTypeScreen } from './ChooseAccountTypeScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

/** Param list เต็มของ auth flow (5 หน้าตามแผน) Login/Register/OtpVerify/ChooseAccountType */
/** ผ่าน Google มาแล้วรออีกสองขั้น ตั๋วนี้พิสูจน์ว่าคุยกับ Google สำเร็จ */
export type GoogleHandoff = {
  googleToken: string;
  prefill: { email: string | null; fullName: string | null };
};

export type AuthStackParamList = {
  Login: undefined;
  /** มี `google` = มาจากปุ่ม Google จึงไม่ต้องตั้งรหัสผ่าน */
  Register: { google: GoogleHandoff } | undefined;
  OtpVerify: { form: RegisterFormValues; google?: GoogleHandoff };
  ChooseAccountType: {
    form: RegisterFormValues;
    /** ตั๋วจาก verifyOtp ต้องยื่นตอนสมัคร ไม่งั้นเซิร์ฟเวอร์ปฏิเสธ */
    verificationToken: string;
    google?: GoogleHandoff;
  };
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { tokens } = useTheme();

  return (
    // design วาดหัวจอเองในแต่ละหน้า ปิด header ของ navigator
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
