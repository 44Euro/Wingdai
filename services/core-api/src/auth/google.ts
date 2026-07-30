import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

/**
 * client ID ของโปรเจกต์ `wingdai-503804` — **เป็นค่าสาธารณะ** ไม่ใช่ความลับ
 * ตัวที่ห้ามหลุดคือ client secret ของ Web client ซึ่งแอปมือถือกับ endpoint นี้ไม่ต้องใช้เลย
 * เก็บไว้ในโค้ดเพราะผูกกับโปรเจกต์ Google ตัวเดียว ไม่ใช่ค่าที่ต่างกันตามสภาพแวดล้อม
 */
const CLIENT_IDS = [
  // Web — เป็น aud ของ id_token ที่ได้จากแอป เพราะเราส่ง webClientId ให้ GoogleSignin.configure()
  '604454119763-53piv5sil6qe42p69pjcpmntou3s86q5.apps.googleusercontent.com',
  '604454119763-km1m49afqj081oin5tincocas48111o5.apps.googleusercontent.com', // iOS
  '604454119763-l58er0h5kabndjqpqruvstrturtv5k97.apps.googleusercontent.com', // Android
];

export type GoogleIdentity = {
  /** ตัวระบุตัวตนถาวรจาก Google — ใช้ตัวนี้ผูกบัญชี ไม่ใช่อีเมล */
  sub: string;
  email: string | null;
  /** Google ยืนยันอีเมลนี้แล้วหรือยัง — ไม่ได้แปลว่าเรายืนยัน แค่บอกว่า Google ยืนยัน */
  emailVerified: boolean;
  name: string | null;
};

@Injectable()
export class GoogleVerifier {
  /**
   * ตัวเดียวทั้งแอป เพราะมันแคชกุญแจสาธารณะของ Google ไว้ข้างใน
   * สร้างใหม่ทุก request = ไปดึงกุญแจใหม่ทุกครั้ง ช้าและโดน rate limit ได้
   */
  private readonly client = new OAuth2Client();

  /**
   * ตรวจ id_token ที่แอปส่งมา **ต้องทำฝั่งเซิร์ฟเวอร์เท่านั้น**
   *
   * ถ้าเชื่อข้อมูลผู้ใช้ที่แอปส่งมาดื้อ ๆ (เช่นรับแค่ email กับ sub เป็น JSON ธรรมดา)
   * ใครก็ยิง request ปลอมเป็นใครก็ได้ — ความปลอดภัยทั้งหมดของ Google login
   * อยู่ที่การตรวจลายเซ็นของ token ตรงจุดนี้จุดเดียว
   *
   * verifyIdToken ตรวจให้ครบทั้งลายเซ็น (ด้วยกุญแจสาธารณะของ Google), `aud`, `iss` และวันหมดอายุ
   */
  async verify(idToken: string): Promise<GoogleIdentity> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: CLIENT_IDS });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException({ message: 'ยืนยันบัญชี Google ไม่สำเร็จ' });
    }

    if (!payload?.sub) {
      throw new UnauthorizedException({ message: 'ยืนยันบัญชี Google ไม่สำเร็จ' });
    }

    return {
      sub: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  }
}
