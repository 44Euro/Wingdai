import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminOrdersService } from './adminOrders.service';
import type { AdminOrderFilter } from './adminOrders';

const FilterSchema = z.enum(['all', 'delayed', 'unassigned']).default('all');

/** จอเฝ้าออเดอร์ของแอดมิน (design AD2) และตัวเลขสดของ AD1 */
@Controller('admin/orders')
@UseGuards(JwtGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly adminOrders: AdminOrdersService) {}

  /** ใช้ `ZodBody` กับ query ด้วย มันเป็น PipeTransform ธรรมดา ชื่อบอกแค่ที่ที่ใช้บ่อยสุด */
  @Get()
  list(@Query('filter', new ZodBody(FilterSchema)) filter: AdminOrderFilter) {
    return this.adminOrders.listOrders(filter);
  }

  @Get('live')
  live() {
    return this.adminOrders.liveOps();
  }
}
