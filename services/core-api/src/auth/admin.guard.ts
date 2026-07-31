import { Injectable, Inject, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { accounts } from '../db/schema';

/**
 * เฉพาะบัญชี admin — ใช้คู่กับ JwtGuard เสมอ (JwtGuard ต้องมาก่อน)
 *
 * อ่าน account_type จากฐานทุกครั้ง **ไม่อ่านจาก JWT** เพราะตั๋วมีอายุ 30 วัน
 * ถอนสิทธิ์แอดมินแล้วตั๋วใบเก่ายังใช้ได้อีกเป็นเดือนคือช่องโหว่ ไม่ใช่การประหยัดคำสั่ง
 *
 * claude.md §4.1 — บัญชี admin สร้างจาก seed เท่านั้น ไม่มีทางสมัครจากภายนอก
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accountId = request.account?.sub;
    if (!accountId) throw new ForbiddenException({ message: 'เฉพาะผู้ดูแลระบบ' });

    const [row] = await this.db
      .select({ accountType: accounts.accountType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (row?.accountType !== 'admin') throw new ForbiddenException({ message: 'เฉพาะผู้ดูแลระบบ' });
    return true;
  }
}
