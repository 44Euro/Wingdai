import type { ExpoConfig } from 'expo/config';

/**
 * ที่อยู่ของ core-api — ไม่ตั้ง = แอปใช้ข้อมูลจำลองในเครื่อง เปิดได้เสมอ
 *
 * simulator iOS ใช้ localhost ได้เลย · **เครื่องจริงต้องใส่ IP ในวงแลน**
 * ของเครื่องที่รันเซิร์ฟเวอร์ เพราะ localhost บนมือถือคือตัวมือถือเอง
 *   WINGDAI_API_URL=http://192.168.1.42:3000/api npx expo start
 */
const apiBaseUrl = process.env.WINGDAI_API_URL;

const config: ExpoConfig = {
  name: 'Wingdai',
  slug: 'wingdai',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic', // รองรับโหมดมืดตามระบบ
  // deep link กลับเข้าแอปหลัง OAuth — ต้อง build ติดไปกับแอป อัปเดตผ่าน OTA ไม่ได้
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
  // สำหรับ PWA/web) ไปเป็น config plugin ของ expo-splash-screen แทน — ดู AGENTS.md
  // ("Expo HAS CHANGED") ค่า image/resizeMode/backgroundColor เดิมยังคงความหมายเดิม
  // เก็บ expo-localization ไว้ด้วยเพราะ app.config.ts แทนที่ app.json ทั้งไฟล์ (ไม่ merge)
  // และ app.json เดิมประกาศปลั๊กอินนี้ไว้สำหรับ src/i18n ที่ใช้ expo-localization
  plugins: [
    'expo-localization',
    '@maplibre/maplibre-react-native',
    'expo-secure-store',
    [
      'expo-location',
      {
        /**
         * ข้อความที่ผู้ใช้เห็นในกล่องขออนุญาตของ iOS — ต้องบอก **เหตุผล** ไม่ใช่แค่ขอ
         * ค่าเริ่มต้นของปลั๊กอินคือ "Allow Wingdai to access your location" ซึ่งไม่บอกอะไร
         * และ Apple ตีตกตอนรีวิวได้ด้วยเหตุนี้
         *
         * ขอแบบ when-in-use เท่านั้น — claude.md §4.3 กำหนดว่าตำแหน่งเบื้องหลัง
         * เป็นของบทบาทไรเดอร์ตอนทำงานอย่างเดียว ห้ามขอจากบัญชีลูกค้า
         */
        locationWhenInUsePermission:
          'Wingdai ใช้ตำแหน่งของคุณเพื่อบันทึกพิกัดที่อยู่จัดส่ง ให้ไรเดอร์หาบ้านถูกและคิดระยะทางได้ถูกต้อง',
        /**
         * คีย์ always/background ถูกใส่มาโดยปลั๊กอินอยู่แล้ว ลบออกไม่ได้ตรง ๆ
         * จึงเขียนข้อความให้ตรงความจริงไว้แทนที่จะปล่อยเป็นค่าเริ่มต้นที่ไม่บอกเหตุผล
         *
         * iOS จะโชว์ข้อความนี้**ต่อเมื่อแอปขอสิทธิ์ระดับนั้นจริง** ซึ่งตอนนี้ยังไม่ขอเลย
         * และจะขอเฉพาะไรเดอร์ตอนเปิดโหมดทำงานในคลื่นที่ 4 (claude.md §4.3)
         * ลูกค้าจะไม่เห็นข้อความนี้
         */
        locationAlwaysAndWhenInUsePermission:
          'ไรเดอร์ Wingdai แชร์ตำแหน่งระหว่างรับงานส่งอาหาร เพื่อให้ลูกค้าเห็นว่าอาหารถึงไหน — ใช้เฉพาะตอนเปิดโหมดทำงาน',
        locationAlwaysPermission:
          'ไรเดอร์ Wingdai แชร์ตำแหน่งระหว่างรับงานส่งอาหาร เพื่อให้ลูกค้าเห็นว่าอาหารถึงไหน — ใช้เฉพาะตอนเปิดโหมดทำงาน',
        // ยังไม่เปิดจริง — เปิดตอนทำโหมดทำงานของไรเดอร์ในคลื่นที่ 4
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        // ต้องเป็น iOS client ID กลับด้าน — ค่านี้คือ URL scheme ที่ Google เรียกกลับเข้าแอป
        // ผิดตัวเดียวจะกลับเข้าแอปไม่ได้ ค้างอยู่ที่หน้าเว็บของ Google
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
  extra: { apiBaseUrl },
};

export default config;
