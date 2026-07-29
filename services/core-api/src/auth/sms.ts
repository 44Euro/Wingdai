import { Injectable, Logger } from '@nestjs/common';

export const SMS_SENDER = 'WINGDAI_SMS_SENDER';

export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}

/**
 * ยังไม่ได้เลือกผู้ให้บริการ SMS ในไทย (claude.md §11 ข้อ 3) ระหว่างนี้พิมพ์ลง log แทนการส่งจริง
 *
 * จงใจให้เป็น interface + provider ตั้งแต่แรก เพื่อที่ตอนเลือกเจ้าได้แล้วจะเปลี่ยนแค่คลาสเดียว
 * ไม่ต้องไปแก้ตรรกะ OTP ที่มีเรื่องโควตาและ cooldown ปนอยู่
 */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly log = new Logger('SMS');

  async send(phone: string, message: string): Promise<void> {
    this.log.log(`→ ${phone}: ${message}`);
  }
}
