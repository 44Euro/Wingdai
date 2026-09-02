import { localName } from './localName';

/**
 * แทนที่ชื่อในคำตอบจาก API ด้วยชื่อภาษาที่ผู้ใช้ตั้งไว้ ก่อนที่ข้อมูลจะถึงจอ
 *
 * มีจุดที่เรนเดอร์ชื่ออยู่ห้าสิบกว่าจุด ให้แต่ละจอเลือกเองแล้วจะมีจุดที่ลืมเสมอ
 * และจุดที่ลืมคือจุดที่ผู้ใช้เจอ ตัดที่ทางเข้าที่เดียวจึงครอบได้ทั้งหมดโดยไม่ต้องแตะจอไหนเลย
 */
/**
 * `fullName` ไม่อยู่ในนี้โดยตั้งใจ — จอแก้โปรไฟล์เอาค่านี้ไปตั้งต้นในช่องกรอก
 * ถ้าแปลงเป็นอังกฤษแล้วผู้ใช้กดบันทึก ชื่อจริงในฐานจะถูกทับด้วยคำแปล
 * ชื่อของคนอื่นที่เอามาโชว์ใช้คีย์คนละตัว (customerName / riderName) จึงแปลงได้ปลอดภัย
 */
const PAIRS: [base: string, english: string][] = [
  ['name', 'nameEn'],
  ['restaurantName', 'restaurantNameEn'],
  ['customerName', 'customerNameEn'],
  ['riderName', 'riderNameEn'],
];

export function localiseNames<T>(value: T, language: string | undefined): T {
  // ยังไม่ได้ตั้งภาษา (เช่นตอนเทสต์ที่ไม่ได้ init i18n) ให้ปล่อยผ่าน อย่าเดาแทนผู้ใช้
  if (!language || language.startsWith('th')) return value;
  return walk(value, language) as T;
}

function walk(value: unknown, language: string): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, language));
  if (value === null || typeof value !== 'object') return value;

  const row = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(row)) out[key] = walk(v, language);

  for (const [base, english] of PAIRS) {
    // มีคู่ครบทั้งสองฝั่งเท่านั้นถึงแทนที่ ฟิลด์ชื่อที่ไม่มีคู่อังกฤษปล่อยไว้เหมือนเดิม
    if (typeof row[base] === 'string' && english in row) {
      out[base] = localName(row[base] as string, row[english] as string | null, language);
    }
  }
  return out;
}
