import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from './config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { MerchantModule } from './merchant/merchant.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { RefundsModule } from './refunds/refunds.module';
import { StorageModule } from './storage/storage.module';
import { PlatformModule } from './platform/platform.module';
import { SupportModule } from './support/support.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ChatModule } from './chat/chat.module';

/** ให้ตัวโหลดบาลานเซอร์และสคริปต์ทดสอบเช็คได้ว่าเซิร์ฟเวอร์ขึ้นแล้ว */
@Controller('health')
class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}

/** modular monolith ตาม product-spec §5 auth, catalog, order, payment, ledger, notification */
@Module({
  imports: [
    ConfigModule, DbModule, StorageModule, PlatformModule,
    AuthModule, CatalogModule, OrdersModule, MerchantModule, DispatchModule, RefundsModule,
    SupportModule, ReviewsModule, ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
