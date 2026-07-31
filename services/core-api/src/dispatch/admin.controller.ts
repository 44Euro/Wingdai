import {
  Controller, Get, Post, Param, UseGuards, HttpCode, ParseUUIDPipe, Inject, ForbiddenException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { accounts } from '../db/schema';
import { JwtGuard, CurrentAccount } from '../auth/jwt.guard';
import type { SessionClaims } from '../auth/auth.service';
import { DispatchService } from './dispatch.service';

/**
 * ทางแทรกมือของแอดมิน (claude.md §6.3 — "เก็บ manual-override ไว้เป็นตาข่ายนิรภัยเสมอ")
 *
 * บัญชี admin ถูกสร้างจาก seed เท่านั้น ไม่มีทางสมัครจากภายนอก (§4.1)
 */
@Controller('admin/dispatch')
@UseGuards(JwtGuard)
export class AdminDispatchController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly dispatch: DispatchService,
  ) {}

  private async requireAdmin(accountId: string) {
    const [row] = await this.db
      .select({ accountType: accounts.accountType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    if (row?.accountType !== 'admin') throw new ForbiddenException({ message: 'เฉพาะผู้ดูแลระบบ' });
  }

  /** ทำไมออร์เดอร์ใบนี้ยังไม่มีไรเดอร์ — จอ exception-based ของแอดมิน (§7) ต้องตอบคำถามนี้ได้ */
  @Get('orders/:id')
  async explain(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    await this.requireAdmin(me.sub);
    return this.dispatch.explain(id);
  }

  @Post('orders/:id')
  @HttpCode(200)
  async force(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() me: SessionClaims) {
    await this.requireAdmin(me.sub);
    return this.dispatch.forceDispatch(id);
  }
}
