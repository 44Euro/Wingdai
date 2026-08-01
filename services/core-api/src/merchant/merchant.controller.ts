import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode,
} from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { MerchantService } from './merchant.service';
import { AdminGuard } from '../auth/admin.guard';
import {
  RegisterRestaurantSchema, type RegisterRestaurantInput,
  SetApprovalSchema, type SetApprovalInput,
  ListOrdersQuerySchema, type ListOrdersQuery,
  SummaryQuerySchema, type SummaryQuery,
  SetOpenSchema, type SetOpenInput,
  CreateMenuItemSchema, type CreateMenuItemInput,
  UpdateMenuItemSchema, type UpdateMenuItemInput,
} from './dto';

/**
 * ฝั่งร้าน — claude.md §4.3 ร้านเป็น "ความสามารถ" บนบัญชี type `user` ไม่ใช่ประเภทบัญชี
 * จึงไม่มีการเช็ค account_type ที่นี่เลย ทุกเส้นทางตัดสินจาก `restaurants.owner_user_id`
 * ซึ่งเป็นจุดเดียวที่บอกว่าใครเป็นเจ้าของร้าน
 */
@Controller('merchant')
@UseGuards(JwtGuard)
export class MerchantController {
  constructor(private readonly merchant: MerchantService) {}

  @Get('restaurants')
  myRestaurants(@CurrentAccount() me: SessionClaims) {
    return this.merchant.myRestaurants(me.sub);
  }

  /** §4.3 "เปิดร้านของคุณ" — สร้างเป็นร้านที่ยังไม่อนุมัติเสมอ */
  @Post('restaurants')
  register(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(RegisterRestaurantSchema)) body: RegisterRestaurantInput,
  ) {
    return this.merchant.registerRestaurant(me.sub, body);
  }

  @Post('restaurants/:id/submit')
  @HttpCode(200)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.merchant.submitForApproval(me.sub, id);
  }

  @Get('orders')
  orders(
    @CurrentAccount() me: SessionClaims,
    @Query(new ZodBody(ListOrdersQuerySchema)) q: ListOrdersQuery,
  ) {
    return this.merchant.listOrders(me.sub, q);
  }

  /** จอสรุปของร้าน (M1 · M5) — ไม่ระบุร้าน = รวมทุกร้านที่บัญชีนี้เป็นเจ้าของ */
  @Get('summary')
  summary(
    @CurrentAccount() me: SessionClaims,
    @Query(new ZodBody(SummaryQuerySchema)) q: SummaryQuery,
  ) {
    return this.merchant.summary(me.sub, q.restaurantId);
  }

  @Patch('restaurants/:id/open')
  setOpen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(SetOpenSchema)) body: SetOpenInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.setOpen(me.sub, id, body.isOpen);
  }

  @Post('menu')
  createMenuItem(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(CreateMenuItemSchema)) body: CreateMenuItemInput,
  ) {
    return this.merchant.createMenuItem(me.sub, body);
  }

  @Patch('menu/:id')
  updateMenuItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(UpdateMenuItemSchema)) body: UpdateMenuItemInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.updateMenuItem(me.sub, id, body);
  }
}

/** คิวอนุมัติร้านของแอดมิน (§4.3 · §7) */
@Controller('admin/restaurants')
@UseGuards(JwtGuard, AdminGuard)
export class AdminRestaurantsController {
  constructor(private readonly merchant: MerchantService) {}

  @Get('pending')
  pending() {
    return this.merchant.pendingRestaurants();
  }

  @Post(':id/approval')
  @HttpCode(200)
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(SetApprovalSchema)) body: SetApprovalInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.setApproval(me.sub, id, body.approve);
  }
}
