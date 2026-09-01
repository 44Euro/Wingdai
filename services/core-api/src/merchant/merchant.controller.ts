import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode,
} from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { MerchantService } from './merchant.service';
import { RestaurantPayoutService } from './restaurantPayout.service';
import { AdminGuard } from '../auth/admin.guard';
import {
  RegisterRestaurantSchema, type RegisterRestaurantInput,
  SetApprovalSchema, type SetApprovalInput,
  ListOrdersQuerySchema, type ListOrdersQuery,
  SummaryQuerySchema, type SummaryQuery,
  SetOpenSchema, type SetOpenInput,
  CreateMenuItemSchema, type CreateMenuItemInput,
  UpdateMenuItemSchema, type UpdateMenuItemInput,
  SetHoursSchema, type SetHoursInput,
  PauseSchema, type PauseInput,
  RequestMerchantPayoutSchema, type RequestMerchantPayoutInput,
  DecideMerchantPayoutSchema, type DecideMerchantPayoutInput,
} from './dto';

/** ฝั่งร้าน product-spec §4.3 ร้านเป็น "ความสามารถ" บนบัญชี type `user` ไม่ใช่ประเภทบัญชี */
@Controller('merchant')
@UseGuards(JwtGuard)
export class MerchantController {
  constructor(private readonly merchant: MerchantService) {}

  @Get('restaurants')
  myRestaurants(@CurrentAccount() me: SessionClaims) {
    return this.merchant.myRestaurants(me.sub);
  }

  /** §4.3 "เปิดร้านของคุณ" สร้างเป็นร้านที่ยังไม่อนุมัติเสมอ */
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

  /** จอสรุปของร้าน (M1 M5) ไม่ระบุร้าน = รวมทุกร้านที่บัญชีนี้เป็นเจ้าของ */
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

  @Patch('restaurants/:id/hours')
  setHours(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(SetHoursSchema)) body: SetHoursInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.setHours(me.sub, id, body);
  }

  @Post('restaurants/:id/pause')
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(PauseSchema)) body: PauseInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.pause(me.sub, id, body.minutes);
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

  /** ยอดที่ถอนได้ของร้านนี้ พร้อมใบที่ค้างอยู่ */
  @Get('restaurants/:id/payout')
  payoutBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.payoutBalance(me.sub, id);
  }

  @Get('restaurants/:id/payout/history')
  payoutHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.payoutHistory(me.sub, id);
  }

  @Post('restaurants/:id/payout')
  requestPayout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(RequestMerchantPayoutSchema)) body: RequestMerchantPayoutInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.requestPayout(me.sub, id, body.amountSatang);
  }
}

/** คิวอนุมัติร้านของแอดมิน (§4.3 §7) */
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

/** รอบจ่ายเงินร้าน (design AD7) */
@Controller('admin/restaurants')
@UseGuards(JwtGuard, AdminGuard)
export class AdminRestaurantPayoutController {
  constructor(
    private readonly payouts: RestaurantPayoutService,
    private readonly merchant: MerchantService,
  ) {}

  @Get('payables')
  payables() {
    return this.payouts.listPayables();
  }

  @Post(':id/settle')
  @HttpCode(200)
  settle(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.payouts.settle(me.sub, id);
  }

  /** คำขอถอนที่ร้านกดมาเอง รอทีมงานตัดสิน */
  @Get('payout-requests')
  pendingPayouts() {
    return this.merchant.pendingPayouts();
  }

  @Post('payout-requests/:payoutId/decide')
  @HttpCode(200)
  decidePayout(
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body(new ZodBody(DecideMerchantPayoutSchema)) body: DecideMerchantPayoutInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.merchant.decidePayout(me.sub, payoutId, body.approve, body.rejectionReason);
  }

}
