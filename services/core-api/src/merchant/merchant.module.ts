import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/admin.guard';
import { MerchantController, AdminRestaurantsController } from './merchant.controller';
import { MerchantService } from './merchant.service';

@Module({
  imports: [AuthModule],
  controllers: [MerchantController, AdminRestaurantsController],
  providers: [MerchantService, AdminGuard],
})
export class MerchantModule {}
