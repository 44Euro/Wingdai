import { Injectable, Inject, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { accounts } from '../db/schema';
import { isAdmin, isSuperAdmin } from './roles';

/** เฉพาะบัญชี admin และ super_admin ใช้คู่กับ JwtGuard เสมอ (JwtGuard ต้องมาก่อน) */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = await accountTypeOf(this.db, context);
    if (!type || !isAdmin(type)) throw new ForbiddenException({ message: 'เฉพาะผู้ดูแลระบบ' });
    return true;
  }
}

/** เฉพาะ super_admin ใช้กับ `/super/*` เท่านั้น */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = await accountTypeOf(this.db, context);
    if (!type || !isSuperAdmin(type)) {
      // ข้อความเดียวกับกรณีไม่ได้ล็อกอินเลย ไม่บอกใบ้ว่าเส้นทางนี้มีอยู่จริง
      throw new ForbiddenException({ message: 'เฉพาะผู้ดูแลระบบระดับสูง' });
    }
    return true;
  }
}

async function accountTypeOf(db: Db, context: ExecutionContext) {
  const accountId = context.switchToHttp().getRequest().account?.sub;
  if (!accountId) return null;

  const [row] = await db
    .select({ accountType: accounts.accountType })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return row?.accountType ?? null;
}
