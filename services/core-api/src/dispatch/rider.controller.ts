import {
  Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, ParseUUIDPipe,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { RiderService } from './rider.service';
import { AdminGuard } from '../auth/admin.guard';
import { EARNINGS_PERIODS } from './earningsPeriod';
import { RIDER_ISSUE_KINDS } from './riderIssue';
import { RIDER_DOCUMENT_KINDS } from '../storage/storage.controller';

/** แจ้งปัญหาระหว่างส่ง (design R9) */
const ReportIssueSchema = z.object({
  kind: z.enum(RIDER_ISSUE_KINDS),
  detail: z.string().trim().max(500).optional(),
});

/** บันทึกเอกสารที่อัปโหลดแล้ว (design R8) */
const SaveDocumentSchema = z.object({
  kind: z.enum(RIDER_DOCUMENT_KINDS),
  storagePath: z.string().trim().min(1).max(300),
});

/** §7 ปฏิเสธเอกสารต้องมีเหตุผล ตรวจซ้ำที่ service ด้วย ไม่ใช่พึ่ง schema อย่างเดียว */
const DecideDocumentSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(500).optional(),
});

/** ช่วงเวลาบนจอรายได้ (design R6) ไม่ส่งมา = สัปดาห์ ตรงกับค่าตั้งต้นของแอป */
const EarningsQuerySchema = z.object({
  period: z.enum(EARNINGS_PERIODS).default('week'),
});

const CoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** วันที่แบบ YYYY-MM-DD เก็บเป็น date ในฐาน ไม่ใช่ timestamp เพราะไม่มีความหมายระดับเวลา */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ต้องเป็นวันที่รูปแบบ YYYY-MM-DD');

/** ใบสมัครไรเดอร์ (design R5 product-spec §7) รูปเอกสารยังไม่มี เพราะยังไม่ได้ต่อ Storage */
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
  /** §7 ต้องมีทั้งคู่ก่อนอนุมัติ ตรวจซ้ำที่ service ด้วย ไม่ใช่เชื่อว่าจอบังคับติ๊กแล้ว */
  acceptContract: z.boolean(),
  acceptPdpa: z.boolean(),
});

/** ยอดนำส่งเป็นสตางค์จำนวนเต็ม §5 กฎข้อ 1 ห้ามมีทศนิยมในเส้นทางเงิน */
const SettleCashSchema = z.object({
  amountSatang: z.number().int().positive('ยอดนำส่งต้องมากกว่าศูนย์'),
});

/** จุดตั้งทำงาน (design R7) รัศมีจำกัด 1–20 กม. ตรงกับ CHECK ในฐาน */
const WorkBaseSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().int().min(1, 'รัศมีต้องอย่างน้อย 1 กม.').max(20, 'รัศมีมากสุด 20 กม.'),
});

/** ยอดถอนเป็นสตางค์จำนวนเต็ม §5 กฎข้อ 1 ห้ามมีทศนิยมในเส้นทางเงิน */
const RequestPayoutSchema = z.object({
  amountSatang: z.number().int().positive('ยอดถอนต้องมากกว่าศูนย์'),
});

const DecidePayoutSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(500).optional(),
});

const DecideApplicationSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(500).optional(),
});

const SetOnlineSchema = z.object({
  isOnline: z.boolean(),
  /** ต้องส่งมาตอนเปิดรับงาน ไม่รู้พิกัดแล้วให้คะแนนระยะทางไม่ได้ */
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

  /** โซนที่เปิดให้บริการ ใช้ในตัวเลือก "โซนที่อยากวิ่ง" ของใบสมัคร */
  @Get('zones')
  zones() {
    return this.rider.activeZones();
  }

  /** ใบสมัครของตัวเอง (R5) */
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

  /** แจ้งปัญหาระหว่างส่ง (design R9) */
  @Post('jobs/:orderId/issues')
  reportIssue(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodBody(ReportIssueSchema)) body: z.infer<typeof ReportIssueSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.rider.reportIssue(me.sub, orderId, body);
  }

  /** เอกสารของไรเดอร์ (design R8) คืนครบทุกชนิดเสมอ ชนิดที่ยังไม่ส่งได้ `missing` */
  @Get('documents')
  documents(@CurrentAccount() me: SessionClaims) {
    return this.rider.documents(me.sub);
  }

  /** บันทึกว่าอัปโหลดไฟล์ไปที่ไหนแล้ว เส้นทางต้องเป็นของบัญชีนี้ (service ตรวจซ้ำ) */
  @Post('documents')
  saveDocument(
    @Body(new ZodBody(SaveDocumentSchema)) body: z.infer<typeof SaveDocumentSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.rider.saveDocument(me.sub, body.kind, body.storagePath);
  }

  /** §8 ตัวเลขที่ไรเดอร์เห็นเป็นรายได้และชั่วโมง ไม่ใช่อันดับหรือคะแนนแข่งกัน (§3 ข้อ 4) */
  @Get('stats')
  stats(@CurrentAccount() me: SessionClaims) {
    return this.rider.ordersPerHour(me.sub);
  }

  /** จอรายได้ + ประวัติงาน (R4 R6) รวมเป็นครั้งเดียวเพราะจอเดียวใช้ทั้งสองส่วน */
  @Get('earnings')
  earnings(
    @CurrentAccount() me: SessionClaims,
    @Query(new ZodBody(EarningsQuerySchema)) q: z.infer<typeof EarningsQuerySchema>,
  ) {
    return this.rider.earnings(me.sub, q.period);
  }

  /** จุดตั้งทำงาน (design R7) มีผลจริงกับการคัดผู้รับงาน ไม่ใช่แค่ค่าที่เก็บไว้ */
  @Get('work-base')
  workBase(@CurrentAccount() me: SessionClaims) {
    return this.rider.workBase(me.sub);
  }

  @Post('work-base')
  @HttpCode(200)
  setWorkBase(
    @Body(new ZodBody(WorkBaseSchema)) body: z.infer<typeof WorkBaseSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.rider.setWorkBase(me.sub, body);
  }

  /** ยอดเงิน: รายได้ค้างจ่าย เงินสดในมือ และยอดถอนสุทธิ (design R12) */
  @Get('balance')
  balance(@CurrentAccount() me: SessionClaims) {
    return this.rider.balance(me.sub);
  }

  /** ขอถอนเงิน ยังไม่มีเงินออกจนกว่าแอดมินจะยืนยัน (§6.4) */
  @Post('payouts')
  requestPayout(
    @Body(new ZodBody(RequestPayoutSchema)) body: z.infer<typeof RequestPayoutSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.rider.requestPayout(me.sub, body.amountSatang);
  }
}

/** คิวอนุมัติไรเดอร์ของแอดมิน (§7) คู่กับ AdminRestaurantsController */
@Controller('admin/riders')
@UseGuards(JwtGuard, AdminGuard)
export class AdminRidersController {
  constructor(private readonly rider: RiderService) {}

  @Get('pending')
  pending() {
    return this.rider.pendingApplications();
  }

  /** ตรวจเอกสารไรเดอร์ทีละใบ (design R8 §7) */
  /** เอกสารพร้อมลิงก์ดูรูป จอตรวจ KYC ของแอดมิน (design AD6) */
  @Get(':accountId/documents')
  documents(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.rider.documentsForAdmin(accountId);
  }

  @Post(':accountId/documents/:kind')
  @HttpCode(200)
  decideDocument(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('kind') kind: string,
    @Body(new ZodBody(DecideDocumentSchema)) body: z.infer<typeof DecideDocumentSchema>,
  ) {
    return this.rider.decideDocument(accountId, kind, body);
  }

  /** ไรเดอร์ที่ยังถือเงินสดของบริษัทอยู่ (§6.2) */
  @Get('cash')
  cash() {
    return this.rider.ridersHoldingCash();
  }

  /** บันทึกว่าไรเดอร์นำเงินสดมาส่งแล้ว (§6.2) แอดมินเป็นคนกด เพราะเป็นคนรับเงินจริง */
  @Post(':accountId/settle-cash')
  @HttpCode(200)
  settleCash(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodBody(SettleCashSchema)) body: z.infer<typeof SettleCashSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.rider.settleCash(me.sub, accountId, body.amountSatang);
  }

  /** คำขอถอนเงินที่รอตัดสิน (design R12 §6.4 คนยืนยันก่อนเงินออก) */
  @Get('payouts')
  payouts() {
    return this.rider.pendingPayouts();
  }

  @Post('payouts/:payoutId/decide')
  @HttpCode(200)
  decidePayout(
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body(new ZodBody(DecidePayoutSchema)) body: z.infer<typeof DecidePayoutSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.rider.decidePayout(me.sub, payoutId, body.approve, body.rejectionReason);
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
