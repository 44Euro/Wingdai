import { Controller, Get } from '@nestjs/common';
import { PlatformService } from './platform.service';

/** ค่าที่แอปต้องรู้ก่อนวาดจอ ไม่ต้องล็อกอิน เพราะจอสมัครสมาชิกต้องรู้ตั้งแต่ยังไม่มีบัญชี */
@Controller('config')
export class ConfigController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  async get() {
    const flags = await this.platform.flags();
    return {
      paymentMethods: await this.platform.availablePaymentMethods(flags),
      registrationOpen: flags.registration_open,
    };
  }
}
