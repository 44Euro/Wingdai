/**
 * Google sign-in ฝั่ง **เว็บ** — Metro หยิบไฟล์ `.web.ts` แทน `google.ts` ให้เอง
 *
 * `@react-native-google-signin/google-signin` เป็นโมดูลเนทีฟ บนเบราว์เซอร์จึงใช้ไม่ได้
 * ทางที่ถูกคือ Google Identity Services (gsi) ซึ่งเป็นคนละไลบรารีและต้องลงทะเบียน
 * origin ของเว็บไว้ใน Google Console ก่อน — ยังไม่ได้ทำ เพราะเว็บเป็นแค่จอสาธิต
 *
 * จอล็อกอินอ่าน `GOOGLE_SIGN_IN_AVAILABLE` แล้ว **ซ่อนปุ่มไปเลย** ตามกฎ claude.md §10
 * ที่ห้ามปล่อยปุ่มที่กดแล้วไม่เกิดอะไร ฟังก์ชันข้างล่างจึงไม่ควรถูกเรียกเลย
 * ที่ยังมีอยู่เพราะต้องมีรูปร่างเหมือน google.ts ให้ TypeScript ตรวจได้
 */
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
