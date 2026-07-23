import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Prompt_600SemiBold } from '@expo-google-fonts/prompt';
import {
  IBMPlexSansThai_400Regular,
  IBMPlexSansThai_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-thai';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { RootNavigator } from './src/app/RootNavigator';
import { initI18n } from './src/i18n';

const queryClient = new QueryClient();

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  // ชื่อ key ต้องตรงเป๊ะกับ primitives.fontFamily (src/theme/tokens/primitives.ts)
  // เพราะนั่นคือชื่อ family ที่ RN ใช้ค้นหาฟอนต์ที่โหลดไว้ตอน runtime
  const [fontsLoaded] = useFonts({
    Prompt_600SemiBold,
    IBMPlexSansThai_400Regular,
    IBMPlexSansThai_600SemiBold,
  });

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady || !fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
