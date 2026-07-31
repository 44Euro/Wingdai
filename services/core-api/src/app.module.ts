import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from './config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { MerchantModule } from './merchant/merchant.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { RefundsModule } from './refunds/refunds.module';

/** ให้ตัวโหลดบาลานเซอร์และสคริปต์ทดสอบเช็คได้ว่าเซิร์ฟเวอร์ขึ้นแล้ว */
@Controller('health')
class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}

/**
 * modular monolith ตาม claude.md §5 — auth, catalog, order, payment, ledger, notification
 * แม็ปกับโมดูลของ NestJS หนึ่งต่อหนึ่ง แยกออกเป็นเซอร์วิสจริงค่อยว่ากันเมื่อโหลดบังคับ
 */
@Module({
  imports: [ConfigModule, DbModule, AuthModule, CatalogModule, OrdersModule, MerchantModule, DispatchModule, RefundsModule],
  controllers: [HealthController],
})
export class AppModule {}
