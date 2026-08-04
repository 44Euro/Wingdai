import { Injectable, Inject } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { auditLog, accounts } from '../db/schema';

/** การกระทำที่ต้องลงประวัติ (design SA5 "Every refund, payout & role change") */
export const AUDIT_ACTIONS = [
  'refund.approved',
  'refund.rejected',
  'restaurant.settled',
  'restaurant.approved',
  'rider.approved',
  'rider.rejected',
  'rider.cash_settled',
  'rider.payout_paid',
  'pricing.changed',
  'flag.changed',
  'role.changed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** ทรานแซกชันของ drizzle ชนิดเดียวกับที่ `db.transaction(async (tx) => …)` ส่งเข้ามา */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type AuditEntry = {
  actorId: string;
  action: AuditAction;
  subjectType: string;
  subjectId?: string | null;
  before?: unknown;
  after?: unknown;
};

/** เขียนแถวประวัติ ในทรานแซกชันเดียวกับการกระทำ */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    actorAccountId: entry.actorId,
    action: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}

export type AuditRow = {
  id: string;
  action: string;
  actorName: string;
  actorUsername: string;
  subjectType: string;
  subjectId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** อ่านประวัติย้อนหลัง (design SA5) */
  async list(action?: string, limit = 100): Promise<AuditRow[]> {
    const rows = await this.db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        actorName: accounts.fullName,
        actorUsername: accounts.username,
        subjectType: auditLog.subjectType,
        subjectId: auditLog.subjectId,
        before: auditLog.before,
        after: auditLog.after,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .innerJoin(accounts, eq(accounts.id, auditLog.actorAccountId))
      .where(action ? eq(auditLog.action, action) : sql`true`)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
}
