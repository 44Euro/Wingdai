import { GoogleSignin } from '@react-native-google-signin/google-signin';

/** client ID ของโปรเจกต์ Google `wingdai-503804` เป็นค่าสาธารณะ เก็บในโค้ดได้ */
const WEB_CLIENT_ID = '604454119763-53piv5sil6qe42p69pjcpmntou3s86q5.apps.googleusercontent.com';
const IOS_CLIENT_ID = '604454119763-km1m49afqj081oin5tincocas48111o5.apps.googleusercontent.com';

/** เนทีฟมีโมดูลนี้เสมอ ฝั่งเว็บ (`google.web.ts`) ประกาศเป็น false แล้วจอล็อกอินจะซ่อนปุ่มให้ */
export const GOOGLE_SIGN_IN_AVAILABLE = true;

let configured = false;

/** ตั้งค่าครั้งเดียวก่อนใช้ เรียกซ้ำได้ ไม่มีผลข้างเคียง */
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    // ไม่ขอ refresh token ฝั่งเซิร์ฟเวอร์ เพราะเราใช้ Google เพื่อ "ยืนยันตัวตน" ครั้งเดียว
    offlineAccess: false,
  });
  configured = true;
}

export class GoogleCancelled extends Error {
  constructor() {
    super('ผู้ใช้ยกเลิกการเข้าสู่ระบบด้วย Google');
    this.name = 'GoogleCancelled';
  }
}

/** เปิดหน้าเลือกบัญชี Google แล้วคืน id_token ให้เอาไปให้เซิร์ฟเวอร์ตรวจ */
export async function signInWithGoogle(): Promise<string> {
  ensureConfigured();

  // Android ที่ไม่มี Google Play Services เข้าไม่ได้ เช็คก่อนเพื่อได้ข้อความที่อ่านรู้เรื่อง
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const res = await GoogleSignin.signIn();
  // กดยกเลิกไม่ใช่ความผิดพลาด แยกชนิดไว้ให้จอเงียบ ไม่ต้องขึ้น error
  if (res.type !== 'success') throw new GoogleCancelled();

  const idToken = res.data.idToken;
  if (!idToken) throw new Error('Google ไม่ได้ส่ง id_token กลับมา');
  return idToken;
}

/** ล้างบัญชีที่ Google จำไว้ เพื่อให้ครั้งหน้าเลือกบัญชีใหม่ได้ */
export async function signOutFromGoogle(): Promise<void> {
  ensureConfigured();
  try {
    await GoogleSignin.signOut();
  } catch {
    // ไม่เคยล็อกอินด้วย Google ก็ไม่มีอะไรให้ออก ไม่ใช่ error ที่ผู้ใช้ต้องรู้
  }
}
