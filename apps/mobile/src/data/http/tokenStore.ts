/**
 * ที่เก็บ token ของเซสชัน
 *
 * เป็น interface เพราะ `createHttpRepos` ไม่ควรรู้ว่า token เก็บที่ไหน —
 * บนเครื่องจริงเก็บใน Keychain (ดู session.ts) แต่สคริปต์ `npm run api:check`
 * รันในโหนดที่ไม่มี Keychain
 *
 * **ไฟล์นี้ต้องไม่ import อะไรจาก expo หรือ react-native เลย** เพราะสคริปต์ที่รันนอกแอป
 * import ตัวนี้ตรง ๆ — ถ้าลากไลบรารีฝั่งเครื่องเข้ามา สคริปต์จะ transform ไม่ผ่าน
 */
export type TokenStore = {
  load(): Promise<string | null>;
  get(): string | null;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
};

/** ที่เก็บในหน่วยความจำ — ใช้ในสคริปต์ตรวจ API และเทสต์ ไม่ใช้บนเครื่องจริง */
export function createMemoryTokenStore(): TokenStore {
  let token: string | null = null;
  return {
    async load() {
      return token;
    },
    get() {
      return token;
    },
    async set(next) {
      token = next;
    },
    async clear() {
      token = null;
    },
  };
}
