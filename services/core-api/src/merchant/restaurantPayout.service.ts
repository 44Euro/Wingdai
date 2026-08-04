import { randomUUID } from 'node:crypto';
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { ledgerEntries, restaurants } from '../db/schema';
import { postRestaurantPayout, assertRestaurantPayoutAllowed } from '../ledger/postRestaurantPayout';
import { writeAudit } from '../platform/audit.service';

export type RestaurantPayable = {
  restaurantId: string;
  name: string;
  ownerName: string;
  payableSatang: number;
  orderCount: number;
};

/** รอบจ่ายเงินร้าน (design AD7 product-spec §6.2) */
@Injectable()
export class RestaurantPayoutService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** ยอดค้างจ่ายอ่านจาก ledger ไม่ใช่จากตาราง orders */
  private readonly payableExpr = sql`coalesce(le.restaurant_id, o.restaurant_id)`;

  async listPayables(): Promise<RestaurantPayable[]> {
    const rows = await this.db.execute<{
      restaurant_id: string;
      name: string;
      owner_name: string;
      payable_satang: number;
      order_count: number;
    }>(sql`
      select ${this.payableExpr} as restaurant_id,
             r.name, owner.full_name as owner_name,
             sum(le.credit_satang - le.debit_satang)::int as payable_satang,
             count(distinct le.order_id)::int as order_count
        from ledger_entries le
        left join orders o on o.id = le.order_id
        join restaurants r on r.id = ${this.payableExpr}
        join accounts owner on owner.id = r.owner_user_id
       where le.account = 'restaurant_payable'
       group by ${this.payableExpr}, r.name, owner.full_name
      having sum(le.credit_satang - le.debit_satang) > 0
       order by payable_satang desc
    `);

    return rows.map((r) => ({
      restaurantId: r.restaurant_id,
      name: r.name,
      ownerName: r.owner_name,
      payableSatang: r.payable_satang,
      orderCount: r.order_count,
    }));
  }

  /** จ่ายยอดค้างทั้งก้อนของร้านหนึ่ง */
  async settle(adminAccountId: string, restaurantId: string): Promise<{ paidSatang: number }> {
    return this.db.transaction(async (tx) => {
      const [shop] = await tx
        .select({ id: restaurants.id })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId))
        .limit(1);
      if (!shop) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });

      const [balance] = await tx.execute<{ payable_satang: number }>(sql`
        select coalesce(sum(le.credit_satang - le.debit_satang), 0)::int as payable_satang
          from ledger_entries le
          left join orders o on o.id = le.order_id
         where le.account = 'restaurant_payable'
           and coalesce(le.restaurant_id, o.restaurant_id) = ${restaurantId}
      `);

      const payableSatang = balance?.payable_satang ?? 0;
      try {
        assertRestaurantPayoutAllowed({ amountSatang: payableSatang, payableSatang });
      } catch (e) {
        throw new ConflictException({ message: (e as Error).message });
      }

      const entryGroupId = randomUUID();
      await tx.insert(ledgerEntries).values(
        postRestaurantPayout({ amountSatang: payableSatang }).map((l) => ({
          entryGroupId,
          account: l.account,
          debitSatang: l.debitSatang,
          creditSatang: l.creditSatang,
          restaurantId: l.account === 'restaurant_payable' ? restaurantId : null,
          counterpartyAccountId: adminAccountId,
          reason: 'restaurant.payout',
        })),
      );

      // SA5 ระบุ "every payout" เขียนในทรานแซกชันเดียวกับ ledger ไม่ใช่ตามหลัง
      await writeAudit(tx, {
        actorId: adminAccountId,
        action: 'restaurant.settled',
        subjectType: 'restaurant',
        subjectId: restaurantId,
        before: { payableSatang },
        after: { payableSatang: 0, paidSatang: payableSatang },
      });

      return { paidSatang: payableSatang };
    });
  }
}
