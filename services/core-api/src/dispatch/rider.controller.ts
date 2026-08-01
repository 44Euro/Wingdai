import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { RiderService } from './rider.service';
import { AdminGuard } from '../auth/admin.guard';

const CoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** วันที่แบบ YYYY-MM-DD — เก็บเป็น date ในฐาน ไม่ใช่ timestamp เพราะไม่มีความหมายระดับเวลา */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ต้องเป็นวันที่รูปแบบ YYYY-MM-DD');

/** ใบสมัครไรเดอร์ (design R5 · claude.md §7) — รูปเอกสารยังไม่มี เพราะยังไม่ได้ต่อ Storage */
const RiderApplicationSchema = z.object({
  nationalId: z.string().trim().min(13).max(20),
  dateOfBirth: IsoDate,
  vehicleRegistration: z.string().trim().min(1, 'กรุณากรอกทะเบียนรถ').max(20),
  licenceExpiry: IsoDate,
  compulsoryInsuranceExpiry: IsoDate,
  bankName: z.string().trim().min(1, 'กรุณากรอกชื่อธนาคาร').max(60),
  bankAccountNumber: z.string().trim().min(8, 'เลขบัญชีสั้นเกินไป').max(20),
  bankAccountName: z.string().trim().min(1, 'กรุณากรอกชื่อบัญชี').max(120),
  emergencyContactName: z.string().trim().min(1, 'กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน').max(120),
  emergencyContactPhone: z.string().trim().regex(/^0[689][0-9]{8}$/, 'เบอร์ติดต่อฉุกเฉินไม่ถูกต้อง'),
  preferredZoneId: z.uuid().optional(),
  /** §7 ต้องมีทั้งคู่ก่อนอนุมัติ — ตรวจซ้ำที่ service ด้วย ไม่ใช่เชื่อว่าจอบังคับติ๊กแล้ว */
  acceptContract: z.boolean(),
  acceptPdpa: z.boolean(),
});

const DecideApplicationSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(500).optional(),
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

  /** โซนที่เปิดให้บริการ — ใช้ในตัวเลือก "โซนที่อยากวิ่ง" ของใบสมัคร */
  @Get('zones')
  zones() {
    return this.rider.activeZones();
  }

  /**
   * ใบสมัครของตัวเอง (R5)
   *
   * ไม่ใช้ JwtGuard ระดับ approved เพราะจุดทั้งหมดของเส้นทางนี้คือคนที่ **ยังไม่อนุมัติ**
   */
  @Get('application')
  application(@CurrentAccount() me: SessionClaims) {
    return this.rider.application(me.sub);
  }

  @Post('application')
  @HttpCode(200)
  submitApplication(
    @CurrentAccount() me: SessionClaims,
    @Body(new ZodBody(RiderApplicationSchema)) body: z.infer<typeof RiderApplicationSchema>,
  ) {
    return this.rider.submitApplication(me.sub, body);
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

/** คิวอนุมัติไรเดอร์ของแอดมิน (§7) — คู่กับ AdminRestaurantsController */
@Controller('admin/riders')
@UseGuards(JwtGuard, AdminGuard)
export class AdminRidersController {
  constructor(private readonly rider: RiderService) {}

  @Get('pending')
  pending() {
    return this.rider.pendingApplications();
  }

  @Post(':accountId/approval')
  @HttpCode(200)
  decide(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodBody(DecideApplicationSchema)) body: z.infer<typeof DecideApplicationSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.rider.decideApplication(me.sub, accountId, body.approve, body.rejectionReason);
  }
}
