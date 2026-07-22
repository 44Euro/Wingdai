import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Wingdai',
  slug: 'wingdai',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic', // รองรับโหมดมืดตามระบบ
  ios: { supportsTablet: false, bundleIdentifier: 'com.wingdai.app' },
  android: {
    package: 'com.wingdai.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FEFBF7',
    },
  },
  // Expo SDK 57 ย้าย splash screen ของ native ออกจาก field `splash` เดิม (ตอนนี้เหลือแค่
  // สำหรับ PWA/web) ไปเป็น config plugin ของ expo-splash-screen แทน — ดู AGENTS.md
  // ("Expo HAS CHANGED") ค่า image/resizeMode/backgroundColor เดิมยังคงความหมายเดิม
  // เก็บ expo-localization ไว้ด้วยเพราะ app.config.ts แทนที่ app.json ทั้งไฟล์ (ไม่ merge)
  // และ app.json เดิมประกาศปลั๊กอินนี้ไว้สำหรับ src/i18n ที่ใช้ expo-localization
  plugins: [
    'expo-localization',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#FEFBF7',
      },
    ],
  ],
};

export default config;
