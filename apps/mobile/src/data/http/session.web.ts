import type { TokenStore } from './tokenStore';

const KEY = 'wingdai.session.token';

/** ที่เก็บ token ของ เว็บ Metro หยิบไฟล์ `.web.ts` แทน `session.ts` ให้เอง */
let cached: string | null = null;

/** SSR / ตอน prerender ไม่มี window อย่าให้พังตั้งแต่ import */
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
