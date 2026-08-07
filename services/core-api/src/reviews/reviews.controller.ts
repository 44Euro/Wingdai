import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { ReviewsService } from './reviews.service';
import { WriteReviewSchema, type WriteReviewInput } from './dto';

/** ลูกค้าเขียนรีวิวของออร์เดอร์ตัวเอง (design C11) */
@Controller('orders/:orderId/review')
@UseGuards(JwtGuard)
export class OrderReviewController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  write(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(WriteReviewSchema)) body: WriteReviewInput,
  ) {
    return this.reviews.write(me.sub, orderId, body);
  }

  /** จอ C11 เปิดมาต้องรู้ว่าใบนี้รีวิวไปแล้วหรือยัง จะได้ไม่โชว์ฟอร์มให้กรอกซ้ำ */
  @Get()
  forOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.reviews.forOrder(orderId);
  }
}

/** รีวิวของร้านหนึ่ง (design C36) ไม่ต้องล็อกอินก็อ่านได้ */
@Controller('catalog/restaurants/:restaurantId/reviews')
export class RestaurantReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('restaurantId', ParseUUIDPipe) restaurantId: string) {
    return this.reviews.forRestaurant(restaurantId);
  }
}

/** รีวิวที่ร้านของฉันได้รับ (design M9) */
@Controller('merchant/restaurants/:restaurantId/reviews')
@UseGuards(JwtGuard)
export class MerchantReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  mine(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.reviews.forMyRestaurant(me.sub, restaurantId);
  }
}
