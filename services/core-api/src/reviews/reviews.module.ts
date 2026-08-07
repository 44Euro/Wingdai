import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReviewsService } from './reviews.service';
import {
  OrderReviewController, RestaurantReviewsController, MerchantReviewsController,
} from './reviews.controller';

/** `StorageService` มาจาก `StorageModule` ซึ่งเป็น `@Global` จึงไม่ต้อง import ที่นี่ */
@Module({
  imports: [AuthModule],
  controllers: [OrderReviewController, RestaurantReviewsController, MerchantReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
