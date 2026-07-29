import { Injectable, Logger } from '@nestjs/common';

export const SMS_SENDER = 'WINGDAI_SMS_SENDER';

export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}

/** ยังไม่ได้เลือกผู้ให้บริการ SMS ในไทย (product-spec §11 ข้อ 3) ระหว่างนี้พิมพ์ลง log แทนการส่งจริง */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly log = new Logger('SMS');

  async send(phone: string, message: string): Promise<void> {
    this.log.log(`→ ${phone}: ${message}`);
  }
}
