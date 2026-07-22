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

export {};
