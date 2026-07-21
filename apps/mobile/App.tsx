import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { linking } from './src/app/linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Prompt_700Bold, Prompt_600SemiBold } from '@expo-google-fonts/prompt';
import {
  IBMPlexSansThai_400Regular,
  IBMPlexSansThai_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-thai';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { RootNavigator } from './src/app/RootNavigator';
import { WebFrame } from './src/app/WebFrame';
import { initI18n } from './src/i18n';
import { initDataSource } from './src/data';

const queryClient = new QueryClient();

export default function App() {
  // i18n กับแหล่งข้อมูลต้องพร้อมทั้งคู่ก่อนวาดจอแรก จอที่วาดก่อนรู้ว่าเซิร์ฟเวอร์ตอบไหม
  const [ready, setReady] = useState(false);
  // ชื่อ key ต้องตรงเป๊ะกับ primitives.fontFamily (src/theme/tokens/primitives.ts)
  const [fontsLoaded, fontError] = useFonts({
    Prompt_700Bold,
    Prompt_600SemiBold,
    IBMPlexSansThai_400Regular,
    IBMPlexSansThai_600SemiBold,
  });

  useEffect(() => {
    Promise.all([initI18n(), initDataSource()]).then(() => setReady(true));
  }, []);

  // ฟอนต์โหลดไม่ขึ้นก็ยังต้องเข้าแอปได้ ใช้ฟอนต์ระบบแทน
  if (!ready || (!fontsLoaded && !fontError)) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {/* บนเว็บบีบแอปไว้ที่ความกว้างมือถือแล้ววางกลางจอ บนมือถือไม่ทำอะไร */}
          <WebFrame>
            <NavigationContainer linking={linking}>
              <RootNavigator />
            </NavigationContainer>
          </WebFrame>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
