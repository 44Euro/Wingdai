import { hash, verify, Algorithm } from '@node-rs/argon2';

/** product-spec §5 argon2id เท่านั้น */
const PARAMS = {
  algorithm: Algorithm.Argon2id,
  // ค่าตามที่ OWASP แนะนำสำหรับ argon2id (m=19MiB, t=2, p=1)
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

/** คืน false เมื่อรหัสไม่ตรง และเมื่อ hash ในฐานเสียหาย ไม่โยน error ออกไป */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, PARAMS);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** เผาเวลาให้เท่ากับการตรวจรหัสจริง ในเคสที่หา identifier ไม่เจอ */
export async function burnPasswordTime(plain: string): Promise<void> {
  dummyHash ??= hashPassword('wingdai-dummy-password-not-in-use');
  await verifyPassword(plain, await dummyHash);
}
