import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * client ID ของโปรเจกต์ Google `wingdai-503804` — **เป็นค่าสาธารณะ** เก็บในโค้ดได้
 * ตัวที่ห้ามหลุดคือ client secret ของ Web client ซึ่งแอปมือถือไม่ต้องใช้เลย
 */
const WEB_CLIENT_ID = '604454119763-53piv5sil6qe42p69pjcpmntou3s86q5.apps.googleusercontent.com';
const IOS_CLIENT_ID = '604454119763-km1m49afqj081oin5tincocas48111o5.apps.googleusercontent.com';

let configured = false;

/**
 * ตั้งค่าครั้งเดียวก่อนใช้ — เรียกซ้ำได้ ไม่มีผลข้างเคียง
 *
 * `webClientId` ต้องเป็น **Web client ID** ไม่ใช่ของ iOS/Android
 * เพราะมันคือค่าที่ Google ใส่ใน `aud` ของ id_token ที่ส่งกลับมา
 * ใส่ผิดตัวจะได้ token ที่เซิร์ฟเวอร์ตรวจไม่ผ่านโดยไม่มีอะไรบอกว่าผิดที่ไหน
 */
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    // ไม่ขอ refresh token ฝั่งเซิร์ฟเวอร์ เพราะเราใช้ Google เพื่อ "ยืนยันตัวตน" ครั้งเดียว
    // ไม่ได้ไปอ่านข้อมูล Google ของผู้ใช้ต่อ — ขอสิทธิ์เท่าที่ใช้จริง
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

/**
 * เปิดหน้าเลือกบัญชี Google แล้วคืน id_token ให้เอาไปให้เซิร์ฟเวอร์ตรวจ
 *
 * **ห้ามเชื่อข้อมูลผู้ใช้ที่ได้จากตรงนี้** (`data.user.email` ฯลฯ) มันมาจากฝั่งแอป
 * ซึ่งแก้ได้ ตัวที่เชื่อได้คือ id_token ที่เซิร์ฟเวอร์ตรวจลายเซ็นกับกุญแจของ Google แล้วเท่านั้น
 */
export async function signInWithGoogle(): Promise<string> {
  ensureConfigured();

  // Android ที่ไม่มี Google Play Services เข้าไม่ได้ — เช็คก่อนเพื่อได้ข้อความที่อ่านรู้เรื่อง
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const res = await GoogleSignin.signIn();
  // กดยกเลิกไม่ใช่ความผิดพลาด — แยกชนิดไว้ให้จอเงียบ ไม่ต้องขึ้น error
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
    // ไม่เคยล็อกอินด้วย Google ก็ไม่มีอะไรให้ออก — ไม่ใช่ error ที่ผู้ใช้ต้องรู้
  }
}
