import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { zones } from '../db/schema';

export type ZoneInput = {
  name: string;
  type: 'university' | 'condo_cluster' | 'office_district' | 'mixed';
  lat: number;
  lng: number;
};

export type ZoneRow = ZoneInput & {
  id: string;
  liveOrders: number;
  ridersOnline: number;
  gmvSatang: number;
};

/** โซน (design SA2) */
@Injectable()
export class ZonesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(): Promise<ZoneRow[]> {
    const rows = await this.db.execute<{
      id: string;
      name: string;
      type: ZoneInput['type'];
      lat: number;
      lng: number;
      live_orders: number;
      riders_online: number;
      gmv_satang: number;
    }>(sql`
      select z.id, z.name, z.type,
             st_y(z.center::geometry) as lat, st_x(z.center::geometry) as lng,
             (select count(*) from orders o
               where o.zone_id = z.id
                 and o.status not in ('delivered', 'cancelled'))::int as live_orders,
             (select count(*) from rider_status rs
               where rs.zone_id = z.id and rs.is_online)::int as riders_online,
             (select coalesce(sum(
                        o.food_total_satang + o.delivery_fee_satang + o.service_fee_satang), 0)
                from orders o
               where o.zone_id = z.id and o.status = 'delivered'
                 and o.delivered_at > now() - interval '30 days')::int as gmv_satang
        from zones z
       order by z.name
    `);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      lat: Number(r.lat),
      lng: Number(r.lng),
      liveOrders: r.live_orders,
      ridersOnline: r.riders_online,
      gmvSatang: r.gmv_satang,
    }));
  }

  /** สร้างโซนใหม่ ไม่ต้องวาดขอบเขต */
  async create(actorId: string, input: ZoneInput) {
    const [row] = await this.db
      .insert(zones)
      .values({
        name: input.name,
        type: input.type,
        center: { x: input.lng, y: input.lat },
        boundaryGeojson: squareAround(input.lat, input.lng),
        isActive: true,
      })
      .returning({ id: zones.id });

    return { id: row!.id, ...input };
  }

  async update(actorId: string, id: string, input: ZoneInput) {
    const [row] = await this.db
      .update(zones)
      .set({ name: input.name, type: input.type, center: { x: input.lng, y: input.lat } })
      .where(eq(zones.id, id))
      .returning({ id: zones.id });

    if (!row) throw new NotFoundException({ message: 'ไม่พบโซนนี้' });
    return { id: row.id, ...input };
  }
}

/** ~1 กม. รอบจุดกลาง มีไว้ให้คอลัมน์ที่ยังบังคับ NOT NULL มีค่าเท่านั้น */
function squareAround(lat: number, lng: number) {
  const d = 0.009;
  return {
    type: 'Polygon' as const,
    coordinates: [[
      [lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d],
      [lng - d, lat - d],
    ]],
  };
}
