import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import type { OrderStatus } from '../orders/stateMachine';

export type OpsMapRider = {
  accountId: string;
  fullName: string;
  lat: number;
  lng: number;
  /** กำลังถืองานอยู่ หมุดคนละสีจากคนที่ว่าง เพราะสองกลุ่มนี้แอดมินทำอะไรกับมันต่างกัน */
  busy: boolean;
  lastPingAt: string | null;
};

export type OpsMapOrder = {
  id: string;
  reference: string;
  lat: number;
  lng: number;
  status: OrderStatus;
  hasRider: boolean;
};

export type OpsMapData = { riders: OpsMapRider[]; orders: OpsMapOrder[] };

/** แผนที่ภาพรวมของแอดมิน (design AD8) */
@Injectable()
export class OpsMapService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async snapshot(): Promise<OpsMapData> {
    const riderRows = await this.db.execute<{
      account_id: string;
      full_name: string;
      lat: number;
      lng: number;
      busy: boolean;
      last_ping_at: Date | null;
    }>(sql`
      select rs.account_id, a.full_name,
             st_y(rs.location::geometry) as lat,
             st_x(rs.location::geometry) as lng,
             exists (
               select 1 from orders o
                where o.rider_id = rs.account_id
                  and o.status not in ('delivered', 'cancelled')
             ) as busy,
             rs.last_ping_at
        from rider_status rs
        join accounts a on a.id = rs.account_id
       /** ต้องมีทั้งออนไลน์และมีพิกัด ไรเดอร์ที่เพิ่งเปิดรับงานแต่ยังไม่เคยส่งพิกัดมา */
       where rs.is_online and rs.location is not null
    `);

    const orderRows = await this.db.execute<{
      id: string;
      reference: string;
      lat: number;
      lng: number;
      status: OrderStatus;
      has_rider: boolean;
    }>(sql`
      select o.id, o.reference,
             st_y(ad.location::geometry) as lat,
             st_x(ad.location::geometry) as lng,
             o.status, (o.rider_id is not null) as has_rider
        from orders o
        join addresses ad on ad.id = o.delivery_address_id
       where o.status not in ('delivered', 'cancelled')
    `);

    return {
      riders: riderRows.map((r) => ({
        accountId: r.account_id,
        fullName: r.full_name,
        lat: Number(r.lat),
        lng: Number(r.lng),
        busy: r.busy,
        lastPingAt: r.last_ping_at ? new Date(r.last_ping_at).toISOString() : null,
      })),
      orders: orderRows.map((o) => ({
        id: o.id,
        reference: o.reference,
        lat: Number(o.lat),
        lng: Number(o.lng),
        status: o.status,
        hasRider: o.has_rider,
      })),
    };
  }
}
