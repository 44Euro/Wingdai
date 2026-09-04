import { Controller, Get } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { splitPaymentMethods } from './paymentMethods';

/** ค่าที่แอปต้องรู้ก่อนวาดจอ ไม่ต้องล็อกอิน เพราะจอสมัครสมาชิกต้องรู้ตั้งแต่ยังไม่มีบัญชี */
@Controller('config')
export class ConfigController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  async get() {
    const flags = await this.platform.flags();
    const { available, unavailable } = splitPaymentMethods(flags);
    const pricing = await this.platform.pricing();

    return {
      paymentMethods: available,
      unavailablePaymentMethods: unavailable,
      // §6.5 ตะกร้าต้องคิดค่าส่งด้วยตัวเลขชุดเดียวกับที่เซิร์ฟเวอร์เก็บจริง ไม่ใช่ค่าฝังในแอป
      pricing: {
        deliveryBaseSatang: pricing.deliveryBaseSatang,
        deliveryPerKmSatang: pricing.deliveryPerKmSatang,
        serviceFeeSatang: pricing.serviceFeeSatang,
      },
      registrationOpen: flags.registration_open,
    };
  }
}
