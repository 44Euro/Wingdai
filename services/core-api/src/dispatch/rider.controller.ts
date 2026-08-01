import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { RiderService } from './rider.service';

const CoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const SetOnlineSchema = z.object({
  isOnline: z.boolean(),
  /** ต้องส่งมาตอนเปิดรับงาน — ไม่รู้พิกัดแล้วให้คะแนนระยะทางไม่ได้ */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

@Controller('rider')
@UseGuards(JwtGuard)
export class RiderController {
  constructor(private readonly rider: RiderService) {}

  @Get('status')
  status(@CurrentAccount() me: SessionClaims) {
    return this.rider.status(me.sub);
  }

  @Post('online')
  @HttpCode(200)
  setOnline(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(SetOnlineSchema)) body: z.infer<typeof SetOnlineSchema>,
  ) {
    const at = body.lat !== undefined && body.lng !== undefined
      ? { lat: body.lat, lng: body.lng }
      : null;
    return this.rider.setOnline(me.sub, body.isOnline, at);
  }

  @Post('ping')
  @HttpCode(200)
  ping(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(CoordsSchema)) body: z.infer<typeof CoordsSchema>,
  ) {
    return this.rider.ping(me.sub, body.lat, body.lng);
  }

  @Get('jobs')
  jobs(@CurrentAccount() me: SessionClaims) {
    return this.rider.jobs(me.sub);
  }

  @Post('jobs/:orderId/accept')
  @HttpCode(200)
  accept(@Param('orderId', ParseUUIDPipe) orderId: string, @CurrentAccount() me: SessionClaims) {
    return this.rider.acceptOffer(me.sub, orderId);
  }

  @Post('jobs/:orderId/decline')
  @HttpCode(200)
  decline(@Param('orderId', ParseUUIDPipe) orderId: string, @CurrentAccount() me: SessionClaims) {
    return this.rider.declineOffer(me.sub, orderId);
  }

  /** §8 — ตัวเลขที่ไรเดอร์เห็นเป็นรายได้และชั่วโมง ไม่ใช่อันดับหรือคะแนนแข่งกัน (§3 ข้อ 4) */
  @Get('stats')
  stats(@CurrentAccount() me: SessionClaims) {
    return this.rider.ordersPerHour(me.sub);
  }

  /** จอรายได้ + ประวัติงาน (R4 · R6) — รวมเป็นครั้งเดียวเพราะจอเดียวใช้ทั้งสองส่วน */
  @Get('earnings')
  earnings(@CurrentAccount() me: SessionClaims) {
    return this.rider.earnings(me.sub);
  }
}
