import { hash, verify, Algorithm } from '@node-rs/argon2';

/**
 * claude.md §5 — argon2id เท่านั้น
 *
 * ไม่ใช้ bcrypt เพราะมันตัดรหัสผ่านที่ยาวเกิน 72 ไบต์ทิ้งเงียบ ๆ
 * ภาษาไทยกินตัวละ 3 ไบต์ใน UTF-8 แปลว่ารหัสผ่านไทย 24 ตัวก็ชนเพดานแล้ว
 * ผลคือรหัสผ่านสองอันที่ขึ้นต้นเหมือนกันจะล็อกอินแทนกันได้ — เป็นช่องโหว่ ไม่ใช่ข้อจำกัด
 */
const PARAMS = {
  algorithm: Algorithm.Argon2id,
  // ค่าตามที่ OWASP แนะนำสำหรับ argon2id (m=19MiB, t=2, p=1)
  // ใช้เวลาราว 30–60ms ต่อครั้งบนเครื่องทั่วไป ช้าพอจะกันการเดารหัสจำนวนมาก
  // แต่ไม่ช้าจนกลายเป็นช่องให้ยิงถล่มเซิร์ฟเวอร์ผ่านหน้าล็อกอิน
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** ยาวพอจะไม่ถูกเดา สั้นพอจะไม่เป็นช่องยิง DoS (argon2 กินเวลาตามความยาว input) */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 256;

/** ใช้กับความลับสั้น ๆ อย่างรหัส OTP ที่ไม่เข้าเกณฑ์ความยาวของรหัสผ่าน */
export const hashSecret = (plain: string): Promise<string> => hash(plain, PARAMS);

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < PASSWORD_MIN_LENGTH || plain.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `รหัสผ่านต้องยาว ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} ตัวอักษร`,
    );
  }
  return hashSecret(plain);
}

/**
 * คืน false เมื่อรหัสไม่ตรง **และเมื่อ hash ในฐานเสียหาย** ไม่โยน error ออกไป
 *
 * ถ้าปล่อยให้ error ทะลุขึ้นไป คนยิงจะแยกออกว่า "บัญชีนี้มีอยู่แต่ hash พัง" (500)
 * ต่างจาก "รหัสผิด" (401) ซึ่งเป็นการรั่วข้อมูลว่าบัญชีไหนมีจริง
 */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, PARAMS);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * เผาเวลาให้เท่ากับการตรวจรหัสจริง ในเคสที่หา identifier ไม่เจอ
 *
 * ถ้าหาไม่เจอแล้วตอบ 401 กลับทันที เวลาตอบสนองจะสั้นกว่าเคส "รหัสผิด" อย่างเห็นได้ชัด
 * คนยิงจับเวลาเอาก็ไล่ได้ว่า username ไหนมีอยู่จริง แล้วเอาไปทำรายชื่อเป้ายิงต่อ
 * คำนวณครั้งแรกที่เรียกแล้วเก็บไว้ เพราะ argon2 หนึ่งครั้งกิน RAM 19MB — ไม่ควรทำใหม่ทุกรอบ
 */
export async function burnPasswordTime(plain: string): Promise<void> {
  dummyHash ??= hashPassword('wingdai-dummy-password-not-in-use');
  await verifyPassword(plain, await dummyHash);
}
