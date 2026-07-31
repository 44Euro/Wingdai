import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { MerchantService } from './merchant.service';
import {
  ListOrdersQuerySchema, type ListOrdersQuery,
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

  @Get('orders')
  orders(
    @CurrentAccount() me: SessionClaims,
    @Query(new ZodBody(ListOrdersQuerySchema)) q: ListOrdersQuery,
  ) {
    return this.merchant.listOrders(me.sub, q);
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
