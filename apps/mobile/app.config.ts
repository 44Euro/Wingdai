import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Wingdai',
  slug: 'wingdai',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic', // รองรับโหมดมืดตามระบบ
  // deep link กลับเข้าแอปหลัง OAuth ต้อง build ติดไปกับแอป อัปเดตผ่าน OTA ไม่ได้
  scheme: 'wingdai',
  ios: { supportsTablet: false, bundleIdentifier: 'com.wingdai.app' },
  android: {
    package: 'com.wingdai.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FEFBF7',
    },
  },
  // Expo SDK 57 ย้าย splash screen ของ native ออกจาก field `splash` เดิม (ตอนนี้เหลือแค่
  plugins: [
    'expo-localization',
    '@maplibre/maplibre-react-native',
    'expo-secure-store',
    [
      'expo-location',
      {
        /** ข้อความที่ผู้ใช้เห็นในกล่องขออนุญาตของ iOS ต้องบอก เหตุผล ไม่ใช่แค่ขอ */
        locationWhenInUsePermission:
          'Wingdai ใช้ตำแหน่งของคุณเพื่อบันทึกพิกัดที่อยู่จัดส่ง ให้ไรเดอร์หาบ้านถูกและคิดระยะทางได้ถูกต้อง',
        /** คีย์ always/background ถูกใส่มาโดยปลั๊กอินอยู่แล้ว ลบออกไม่ได้ตรง ๆ */
        locationAlwaysAndWhenInUsePermission:
          'ไรเดอร์ Wingdai แชร์ตำแหน่งระหว่างรับงานส่งอาหาร เพื่อให้ลูกค้าเห็นว่าอาหารถึงไหน — ใช้เฉพาะตอนเปิดโหมดทำงาน',
        locationAlwaysPermission:
          'ไรเดอร์ Wingdai แชร์ตำแหน่งระหว่างรับงานส่งอาหาร เพื่อให้ลูกค้าเห็นว่าอาหารถึงไหน — ใช้เฉพาะตอนเปิดโหมดทำงาน',
        // ยังไม่เปิดจริง เปิดตอนทำโหมดทำงานของไรเดอร์ในคลื่นที่ 4
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        // ต้องเป็น iOS client ID กลับด้าน ค่านี้คือ URL scheme ที่ Google เรียกกลับเข้าแอป
        iosUrlScheme:
          'com.googleusercontent.apps.604454119763-km1m49afqj081oin5tincocas48111o5',
      },
    ],
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
