import type { TokenStore } from './tokenStore';

const KEY = 'wingdai.session.token';

/**
 * ที่เก็บ token ของ **เว็บ** — Metro หยิบไฟล์ `.web.ts` แทน `session.ts` ให้เอง
 *
 * ฝั่งเนทีฟใช้ Keychain/Keystore ตาม claude.md §5 แต่เบราว์เซอร์ไม่มีของแบบนั้น
 * `localStorage` อ่านได้ด้วย JavaScript ทุกตัวในหน้าเดียวกัน แปลว่า XSS ครั้งเดียว
 * = token หลุด **เว็บบิลด์จึงเป็นตัวสาธิตเท่านั้น ห้ามใช้กับบัญชีจริง**
 *
 * ทำไมไม่ใช้ cookie แบบ httpOnly ซึ่งปลอดภัยกว่า: มันต้องให้เซิร์ฟเวอร์เป็นคนตั้ง cookie
 * ซึ่งแปลว่า core-api ต้องมีเส้นทาง auth คนละแบบกับที่แอปมือถือใช้ — งานนั้นคุ้มก็ต่อเมื่อ
 * เว็บกลายเป็นช่องทางจริง ไม่ใช่แค่จอสาธิต
 */
let cached: string | null = null;

/** SSR / ตอน prerender ไม่มี window — อย่าให้พังตั้งแต่ import */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // โหมดส่วนตัวของบางเบราว์เซอร์โยน error ตอนแตะ localStorage
    return null;
  }
}

export const session: TokenStore = {
  async load(): Promise<string | null> {
    cached = storage()?.getItem(KEY) ?? null;
    return cached;
  },

  get(): string | null {
    return cached;
  },

  async set(token: string): Promise<void> {
    cached = token;
    storage()?.setItem(KEY, token);
  },

  async clear(): Promise<void> {
    cached = null;
    storage()?.removeItem(KEY);
  },
};
