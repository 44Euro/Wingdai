/**
 * ภาษาที่แอปกำลังใช้อยู่ เก็บไว้ตรงนี้แทนที่จะให้ชั้นข้อมูลไปอ่านจาก i18n ตรง ๆ
 *
 * โมดูล i18n ลาก react-i18next กับ expo-localization ติดมาด้วย ซึ่งทั้งคู่ต้องมี React Native
 * ถ้าชั้นข้อมูลผูกกับมัน สคริปต์ที่รันชั้นข้อมูลนอกแอป (`npm run api:check`) จะแปลงไฟล์ไม่ผ่าน
 * ตั้งแต่ import แรก ชั้นข้อมูลจึงรู้แค่ชื่อภาษาเป็นสตริง ใครเปลี่ยนภาษาก็มาบอกที่นี่
 */
let active: string | undefined;

export function setActiveLanguage(language: string | undefined): void {
  active = language;
}

export function activeLanguage(): string | undefined {
  return active;
}
