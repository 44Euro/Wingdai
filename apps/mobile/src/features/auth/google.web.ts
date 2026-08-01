/** Google sign-in ฝั่ง เว็บ Metro หยิบไฟล์ `.web.ts` แทน `google.ts` ให้เอง */
export const GOOGLE_SIGN_IN_AVAILABLE = false;

export class GoogleCancelled extends Error {
  constructor() {
    super('ผู้ใช้ยกเลิกการเข้าสู่ระบบด้วย Google');
    this.name = 'GoogleCancelled';
  }
}

export async function signInWithGoogle(): Promise<string> {
  throw new Error('เข้าสู่ระบบด้วย Google ใช้ได้เฉพาะบนแอปมือถือ');
}

export async function signOutFromGoogle(): Promise<void> {
  // ไม่เคยล็อกอินด้วย Google บนเว็บได้อยู่แล้ว จึงไม่มีอะไรต้องล้าง
}
