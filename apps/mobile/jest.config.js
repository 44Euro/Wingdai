module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    // @maplibre แจกเป็น ESM — ต้องให้ babel แปลงก่อน ไม่งั้นจอที่ import แผนที่จะ parse ไม่ผ่าน
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|react-native-svg|@maplibre/.*))',
  ],
};
