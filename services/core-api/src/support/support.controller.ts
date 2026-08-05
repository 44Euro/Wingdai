import {
  Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, ParseUUIDPipe,
} from '@nestjs/common';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { SessionClaims } from '../auth/auth.service';
import { SupportService } from './support.service';
import { OpenTicketSchema, type OpenTicketInput, ReplySchema, type ReplyInput } from './dto';

/** ฝั่งลูกค้า เปิดตั๋วและคุยในเธรดของตัวเอง */
@Controller('support/tickets')
@UseGuards(JwtGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  open(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(OpenTicketSchema)) body: OpenTicketInput,
  ) {
    return this.support.open(me.sub, body);
  }

  @Get()
  mine(@CurrentAccount() me: SessionClaims) {
    return this.support.listMine(me.sub);
  }

  /** เธรด service เช็คสิทธิ์เอง เพราะทั้งเจ้าของตั๋วและแอดมินเข้าได้ */
  @Get(':id')
  thread(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.support.thread(me.sub, id);
  }

  @Post(':id/messages')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(ReplySchema)) body: ReplyInput,
  ) {
    return this.support.reply(me.sub, id, body.body);
  }
}

/** ฝั่งแอดมิน คิวตั๋วทั้งระบบ (design AD4) */
@Controller('admin/support')
@UseGuards(JwtGuard, AdminGuard)
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  list(@Query('status') status?: string) {
    return this.support.listForAdmin(status === 'open' || status === 'closed' ? status : undefined);
  }

  @Post('tickets/:id/close')
  @HttpCode(200)
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    return this.support.close(me.sub, id);
  }
}
