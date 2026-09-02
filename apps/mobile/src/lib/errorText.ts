import type { TFunction } from 'i18next';

/**
 * ข้อความ error ที่เอาไปโชว์บนจอ
 *
 * API เขียนข้อความเป็นไทยตายตัวทุกเส้นทาง ยังไม่ได้คืนมาเป็นรหัสให้แอปแปลเอง
 * จอที่เอา `error.message` มาโชว์ตรง ๆ จึงมีไทยโผล่กลางจอเวลาตั้งแอปเป็นอังกฤษ
 *
 * ระหว่างที่ยังไม่ได้เปลี่ยนฝั่งเซิร์ฟเวอร์ ตัดที่ชั้นแสดงผลก่อน — ภาษาไทยได้ข้อความเต็มที่บอก
 * เหตุผลตรง ๆ ส่วนภาษาอื่นตกไปใช้คำกลางที่แปลไว้แล้ว ดีกว่าโชว์ภาษาที่ผู้ใช้อ่านไม่ออก
 */
const THAI = /[฀-๿]/;

export function errorText(error: unknown, t: TFunction, language: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return t('common.errorGeneric');
  if (!language.startsWith('th') && THAI.test(message)) return t('common.errorGeneric');
  return message;
}
