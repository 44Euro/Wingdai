import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { ChatService } from './chat.service';

const ChannelSchema = z.enum(['customer_rider', 'customer_merchant']);
const SendSchema = z.object({
  body: z.string().trim().min(1, 'พิมพ์ข้อความก่อนส่ง').max(1000),
});

/** แชทของออร์เดอร์ (design C10 M10) */
@Controller('orders/:orderId/chat')
@UseGuards(JwtGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get(':channel')
  thread(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('channel') channel: string,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.chat.thread(me.sub, orderId, ChannelSchema.parse(channel));
  }

  @Post(':channel')
  send(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('channel') channel: string,
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(SendSchema)) body: z.infer<typeof SendSchema>,
  ) {
    return this.chat.send(me.sub, orderId, ChannelSchema.parse(channel), body.body);
  }
}
