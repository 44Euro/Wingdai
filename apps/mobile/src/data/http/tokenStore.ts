/** ที่เก็บ token ของเซสชัน */
export type TokenStore = {
  load(): Promise<string | null>;
  get(): string | null;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
};

/** ที่เก็บในหน่วยความจำ ใช้ในสคริปต์ตรวจ API และเทสต์ ไม่ใช้บนเครื่องจริง */
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
