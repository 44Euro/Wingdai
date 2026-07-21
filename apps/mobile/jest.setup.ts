// react-test-renderer ใช้ตรง ๆ ไม่ต้อง setup เพิ่ม

// SafeAreaProvider ของจริงรอ native event "onInsetsChange" ก่อนจะ render children
jest.mock('react-native-safe-area-context', () => {
  // ไฟล์ mock ของไลบรารีเป็น ESM (export default {...}) แต่ transpile เป็น CJS แล้วเก็บ
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// @expo-google-fonts/* เป็นแพ็กเกจ ESM (ขึ้นต้นไฟล์ด้วย "export * from './useFonts'")
jest.mock('@expo-google-fonts/prompt', () => ({
  Prompt_600SemiBold: 'Prompt_600SemiBold-mock-asset',
}));

jest.mock('@expo-google-fonts/ibm-plex-sans-thai', () => ({
  IBMPlexSansThai_400Regular: 'IBMPlexSansThai_400Regular-mock-asset',
  IBMPlexSansThai_600SemiBold: 'IBMPlexSansThai_600SemiBold-mock-asset',
}));

// @maplibre/maplibre-react-native เป็น native module ล้วน แค่ import ก็ throw
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  return {
    Map: View,
    Camera: View,
    Marker: View,
    UserLocation: View,
  };
});

// useFonts ของจริงโหลดไฟล์ .ttf ผ่าน native module (expo-font + expo-asset) ซึ่งไม่มีให้ใช้
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

// @react-native-google-signin/google-signin เป็น native module แค่ import ก็ throw
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ type: 'cancelled', data: null }),
    signOut: jest.fn().mockResolvedValue(null),
  },
}));

// expo-secure-store คุยกับ Keychain/Keystore ซึ่งไม่มีใน jest เก็บใน Map แทน
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
  };
});

// expo-location คุยกับ native GPS ซึ่งไม่มีใน jest mock ที่จุดเดียวเหมือน MapLibre
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest
    .fn()
    .mockResolvedValue({ coords: { latitude: 13.7797, longitude: 100.5418 } }),
}));

export {};
