import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/admin.guard';
import {
  MerchantController, AdminRestaurantsController, AdminRestaurantPayoutController,
} from './merchant.controller';
import { MerchantService } from './merchant.service';
import { RestaurantPayoutService } from './restaurantPayout.service';

@Module({
  imports: [AuthModule],
  controllers: [MerchantController, AdminRestaurantsController, AdminRestaurantPayoutController],
  providers: [MerchantService, RestaurantPayoutService, AdminGuard],
})
export class MerchantModule {}
