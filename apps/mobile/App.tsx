import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { linking } from './src/app/linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryCache, MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Prompt_700Bold, Prompt_600SemiBold } from '@expo-google-fonts/prompt';
import {
  IBMPlexSansThai_400Regular,
  IBMPlexSansThai_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-thai';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { RootNavigator } from './src/app/RootNavigator';
import { NoConnectionScreen } from './src/app/NoConnectionScreen';
import { useConnectionStore, reportRequestError } from './src/app/connectionStore';
import { WebFrame } from './src/app/WebFrame';
import { initI18n } from './src/i18n';
import { initDataSource, pingApi } from './src/data';

// คำขอที่ไปไม่ถึงเซิร์ฟเวอร์รู้ได้ที่นี่ที่เดียว แทนที่จะให้ทุกจอตรวจเอง (SY1)
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportRequestError }),
  mutationCache: new MutationCache({ onError: reportRequestError }),
});

async function reconnect(): Promise<boolean> {
  const ok = await pingApi();
  if (ok) await queryClient.refetchQueries();
  return ok;
}

export default function App() {
  // i18n กับแหล่งข้อมูลต้องพร้อมทั้งคู่ก่อนวาดจอแรก จอที่วาดก่อนรู้ว่าเซิร์ฟเวอร์ตอบไหม
  const [ready, setReady] = useState(false);
  const offline = useConnectionStore((s) => s.offline);
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
            {offline ? (
              <NoConnectionScreen onRetry={reconnect} />
            ) : (
              <NavigationContainer linking={linking}>
                <RootNavigator />
              </NavigationContainer>
            )}
          </WebFrame>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
