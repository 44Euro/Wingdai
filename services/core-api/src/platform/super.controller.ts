import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import { SuperAdminGuard } from '../auth/admin.guard';
import type { SessionClaims } from '../auth/auth.service';
import { ExceptionsService } from '../refunds/exceptions.service';
import { PlatformService, FEATURE_FLAG_KEYS } from './platform.service';
import { AuditService } from './audit.service';
import { ZonesService } from './zones.service';
import { AdminRolesService } from './adminRoles.service';

const PricingSchema = z.object({
  commissionRateBp: z.number().int().min(100).max(3000),
  deliveryBaseSatang: z.number().int().min(0),
  deliveryPerKmSatang: z.number().int().min(0),
  serviceFeeSatang: z.number().int().min(0),
});

const FlagSchema = z.object({ enabled: z.boolean() });

const ZoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['university', 'condo_cluster', 'office_district', 'mixed']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** §7 บทบาทมีสองค่าเท่านั้น ไม่มี "agent อ่านอย่างเดียว" ที่ดีไซน์วาดไว้ */
const RoleSchema = z.object({ role: z.enum(['admin', 'super_admin', 'user']) });

/** ยกบัญชีที่ยังไม่ใช่แอดมินขึ้นมา ค้นด้วยชื่อผู้ใช้ ซูเปอร์แอดมินไม่รู้ uuid ของใคร */
const GrantSchema = z.object({
  username: z.string().trim().min(1, 'ใส่ชื่อผู้ใช้ที่จะให้สิทธิ์'),
  role: z.enum(['admin', 'super_admin']).default('admin'),
});

/** เส้นทางของซูเปอร์แอดมิน (design SA1–SA6) */
@Controller('super')
@UseGuards(JwtGuard, SuperAdminGuard)
export class SuperController {
  constructor(
    private readonly exceptions: ExceptionsService,
    private readonly platform: PlatformService,
    private readonly audit: AuditService,
    private readonly zones: ZonesService,
    private readonly roles: AdminRolesService,
  ) {}

  /** SA1 ตัวเลข §8 ครบ 9 ตัว "โมเดลยังทำกำไรไหม" (ต่างจาก AD1 ที่ตอบว่าอะไรกำลังไหม้) */
  @Get('metrics')
  metrics(@Query('days') days?: string) {
    const parsed = Number(days);
    return this.exceptions.metrics(Number.isInteger(parsed) && parsed > 0 ? parsed : 30);
  }

  @Get('zones')
  listZones() {
    return this.zones.list();
  }

  @Post('zones')
  createZone(
    @Body(new ZodBody(ZoneSchema)) body: z.infer<typeof ZoneSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.zones.create(me.sub, body);
  }

  @Patch('zones/:id')
  updateZone(
    @Param('id') id: string,
    @Body(new ZodBody(ZoneSchema)) body: z.infer<typeof ZoneSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.zones.update(me.sub, id, body);
  }

  @Get('admins')
  listAdmins() {
    return this.roles.list();
  }

  @Post('admins')
  @HttpCode(200)
  grant(
    @Body(new ZodBody(GrantSchema)) body: z.infer<typeof GrantSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.roles.grantByUsername(me.sub, body.username, body.role);
  }

  @Post('admins/:accountId/role')
  @HttpCode(200)
  setRole(
    @Param('accountId') accountId: string,
    @Body(new ZodBody(RoleSchema)) body: z.infer<typeof RoleSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.roles.setRole(me.sub, accountId, body.role);
  }

  /** SA4 + SA6 อยู่จอเดียวกัน จึงคืนมาด้วยกัน เปิดจอครั้งเดียวได้ครบ */
  @Get('config')
  async config() {
    const [pricing, flags] = await Promise.all([this.platform.pricing(), this.platform.flags()]);
    return { pricing, flags, flagKeys: FEATURE_FLAG_KEYS };
  }

  @Patch('config/pricing')
  setPricing(
    @Body(new ZodBody(PricingSchema)) body: z.infer<typeof PricingSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    return this.platform.setPricing(me.sub, body);
  }

  @Patch('config/flags/:key')
  setFlag(
    @Param('key') key: string,
    @Body(new ZodBody(FlagSchema)) body: z.infer<typeof FlagSchema>,
    @CurrentAccount() me: SessionClaims,
  ) {
    // คีย์ที่ไม่รู้จักต้องเด้ง ไม่ใช่เขียนแถวใหม่ที่ไม่มีโค้ดฝั่งไหนอ่าน
    const parsed = z.enum(FEATURE_FLAG_KEYS).parse(key);
    return this.platform.setFlag(me.sub, parsed, body.enabled);
  }

  /** SA5 อ่านอย่างเดียว ไม่มีเส้นทางแก้หรือลบ และจะต้องไม่มีตลอดไป */
  @Get('audit')
  auditLog(@Query('action') action?: string) {
    return this.audit.list(action);
  }
}
