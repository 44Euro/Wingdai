/**
 * Expo SDK 57 ให้ import ไฟล์ CSS ได้บนเว็บ (Metro แยกออกมาเป็นไฟล์ .css ตอน build)
 * แต่ TypeScript ไม่รู้จัก จึงต้องประกาศไว้ — ใช้ที่ TrackingMap.web.tsx
 */
declare module '*.css';
