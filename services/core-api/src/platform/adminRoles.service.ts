import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { accounts } from '../db/schema';
import { writeAudit } from './audit.service';
import type { AccountType } from '../auth/roles';

export type AdminRow = {
  accountId: string;
  username: string;
  fullName: string;
  phone: string;
  role: AccountType;
};

/** ให้และถอนสิทธิ์ผู้ดูแลระบบ (design SA3) */
@Injectable()
export class AdminRolesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(): Promise<AdminRow[]> {
    const rows = await this.db
      .select({
        accountId: accounts.id,
        username: accounts.username,
        fullName: accounts.fullName,
        phone: accounts.phone,
        role: accounts.accountType,
      })
      .from(accounts)
      .where(inArray(accounts.accountType, ['admin', 'super_admin']));

    return rows;
  }

  /** เปลี่ยนบทบาท เขียน audit ในทรานแซกชันเดียวกันเสมอ (SA5 ระบุ "role change" ไว้ตรง ๆ) */
  async setRole(actorId: string, accountId: string, role: AccountType) {
    if (actorId === accountId) {
      throw new BadRequestException({
        message: 'เปลี่ยนบทบาทของตัวเองไม่ได้ — ให้ซูเปอร์แอดมินคนอื่นเป็นคนเปลี่ยนให้',
      });
    }

    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select({ role: accounts.accountType, username: accounts.username })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);

      if (!before) throw new NotFoundException({ message: 'ไม่พบบัญชีนี้' });

      /** บัญชี rider เปลี่ยนเป็นแอดมินไม่ได้ `rider_profiles` มี trigger บังคับว่า */
      if (before.role === 'rider') {
        throw new BadRequestException({ message: 'บัญชีไรเดอร์เปลี่ยนเป็นผู้ดูแลระบบไม่ได้' });
      }

      await tx.update(accounts).set({ accountType: role }).where(eq(accounts.id, accountId));

      await writeAudit(tx, {
        actorId,
        action: 'role.changed',
        subjectType: 'account',
        subjectId: accountId,
        before: { role: before.role, username: before.username },
        after: { role },
      });

      return { accountId, role };
    });
  }
}
