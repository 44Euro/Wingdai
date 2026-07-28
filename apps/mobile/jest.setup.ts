// react-test-renderer ใช้ตรง ๆ ไม่ต้อง setup เพิ่ม
// @testing-library/react-native ถอดออกเพราะ screen/render ไม่ผูกกันใน jest-expo 57 + React 19

// SafeAreaProvider ของจริงรอ native event "onInsetsChange" ก่อนจะ render children
// (ไม่มี event นี้ใน react-test-renderer เพราะไม่มี native bridge) ใช้ mock ที่ไลบรารี
// ประกาศไว้เองสำหรับ jest ตาม docs ของ react-native-safe-area-context เพื่อให้ children
// render ได้ทันทีเหมือนบนอุปกรณ์จริง (ซึ่ง native module ส่ง metrics กลับมาเกือบจะทันที)
jest.mock('react-native-safe-area-context', () => {
  // ไฟล์ mock ของไลบรารีเป็น ESM (export default {...}) แต่ transpile เป็น CJS แล้วเก็บ
  // ทุกอย่างไว้ใต้ key "default" — ต้องแกะออกมาก่อน ไม่งั้น named import (เช่น
  // SafeAreaProvider) จาก App.tsx จะได้ undefined
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// @expo-google-fonts/* เป็นแพ็กเกจ ESM (ขึ้นต้นไฟล์ด้วย "export * from './useFonts'")
// ที่ transformIgnorePatterns ของโปรเจกต์ไม่ได้เปิดให้แปลง (มีแค่ react-native/expo core/
// react-navigation/react-native-svg) ทำให้ jest parse ไฟล์จริงไม่ผ่าน — mock เป็นค่า dummy
// เพราะเทสต์ไม่ได้ตรวจว่าฟอนต์ถูก render จริงบนหน้าจอ แค่ต้องไม่ crash ตอน import/require
jest.mock('@expo-google-fonts/prompt', () => ({
  Prompt_600SemiBold: 'Prompt_600SemiBold-mock-asset',
}));

jest.mock('@expo-google-fonts/ibm-plex-sans-thai', () => ({
  IBMPlexSansThai_400Regular: 'IBMPlexSansThai_400Regular-mock-asset',
  IBMPlexSansThai_600SemiBold: 'IBMPlexSansThai_600SemiBold-mock-asset',
}));

// @maplibre/maplibre-react-native เป็น native module ล้วน — แค่ import ก็ throw
// "TurboModuleRegistry.getEnforcing(...): 'MLRNCameraModule' could not be found"
// เพราะไม่มี native binary ใน react-test-renderer ทำให้จอไหนที่ import แผนที่พังทั้งไฟล์
// mock ให้เป็น View ธรรมดา — เทสต์ตรวจ layout กับข้อมูลรอบแผนที่ ไม่ได้ตรวจตัวแผนที่เอง
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
// ใน react-test-renderer (ไม่มี native bridge) — mock ให้คืน [loaded=true] ทันทีเหมือนโหลด
// เสร็จแล้ว ไม่งั้น App.tsx จะค้างที่ fontsLoaded === false และไม่มีทาง render หน้า login ได้
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

export {};
