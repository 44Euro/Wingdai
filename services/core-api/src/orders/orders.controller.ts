import { Controller, Get, Post, Patch, Body, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { OrdersService } from './orders.service';
import {
  CreateOrderSchema, type CreateOrderInput,
  UpdateStatusSchema, type UpdateStatusInput,
  CreateAddressSchema, type CreateAddressInput,
  TipSchema, type TipInput,
} from './dto';

/** ทุกเส้นทางต้องล็อกอิน ออเดอร์เป็นข้อมูลส่วนตัวและมีเงินเกี่ยวข้อง */
@Controller()
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  create(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(CreateOrderSchema)) body: CreateOrderInput,
  ) {
    return this.orders.create(me.sub, body);
  }

  @Get('orders')
  list(@CurrentAccount() me: SessionClaims) {
    return this.orders.listForCustomer(me.sub);
  }

  @Get('orders/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.orders.getForAccount(id, me.sub);
  }

  @Patch('orders/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(UpdateStatusSchema)) body: UpdateStatusInput,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.orders.updateStatus(
      id, body.status, me.sub,
      { deliveryPin: body.deliveryPin, photoPath: body.photoPath },
      { reason: body.reason },
    );
  }

  /** product-spec §6.5 เงินสดไม่พอแล้วจ่ายพร้อมเพย์แทน ไรเดอร์ไม่ต้องออกเงิน */
  @Post('orders/:id/pay-promptpay')
  @HttpCode(200)
  payWithPromptPay(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.orders.payWithPromptPay(id, me.sub);
  }

  /** ทิปให้ไรเดอร์หลังส่งถึงแล้ว (design C11) เข้าไรเดอร์ 100% ไม่หักคอม */
  @Post('orders/:id/tip')
  @HttpCode(200)
  tip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(TipSchema)) body: TipInput,
  ) {
    return this.orders.tip(id, me.sub, body.amountSatang);
  }

  @Get('addresses')
  listAddresses(@CurrentAccount() me: SessionClaims) {
    return this.orders.listAddresses(me.sub);
  }

  @Post('addresses')
  addAddress(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(CreateAddressSchema)) body: CreateAddressInput,
  ) {
    return this.orders.addAddress(me.sub, body);
  }
}
