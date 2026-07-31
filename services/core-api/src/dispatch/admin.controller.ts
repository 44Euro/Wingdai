import { Controller, Get, Post, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { DispatchService } from './dispatch.service';

/**
 * ทางแทรกมือของแอดมิน (claude.md §6.3 — "เก็บ manual-override ไว้เป็นตาข่ายนิรภัยเสมอ")
 *
 * บัญชี admin ถูกสร้างจาก seed เท่านั้น ไม่มีทางสมัครจากภายนอก (§4.1)
 */
@Controller('admin/dispatch')
@UseGuards(JwtGuard, AdminGuard)
export class AdminDispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  /** ทำไมออร์เดอร์ใบนี้ยังไม่มีไรเดอร์ — จอ exception-based ของแอดมิน (§7) ต้องตอบคำถามนี้ได้ */
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
