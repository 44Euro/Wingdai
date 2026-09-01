import { Controller, Get, Post, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { DispatchService } from './dispatch.service';
import { OpsMapService } from './opsMap.service';

/** ทางแทรกมือของแอดมิน (product-spec §6.3 "เก็บ manual-override ไว้เป็นตาข่ายนิรภัยเสมอ") */
@Controller('admin/dispatch')
@UseGuards(JwtGuard, AdminGuard)
export class AdminDispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  /** ทำไมออเดอร์ใบนี้ยังไม่มีไรเดอร์ จอ exception-based ของแอดมิน (§7) ต้องตอบคำถามนี้ได้ */
  @Get('orders/:id')
  explain(@Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.explain(id);
  }

  @Post('orders/:id')
  @HttpCode(200)
  force(@Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.forceDispatch(id);
  }
}

/** แผนที่ภาพรวม ไรเดอร์ + ออเดอร์ที่ยังวิ่ง (design AD8) */
@Controller('admin/ops')
@UseGuards(JwtGuard, AdminGuard)
export class AdminOpsMapController {
  constructor(private readonly map: OpsMapService) {}

  @Get('map')
  snapshot() {
    return this.map.snapshot();
  }
}
