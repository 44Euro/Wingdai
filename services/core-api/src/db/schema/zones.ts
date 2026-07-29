import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, jsonb, geometry } from 'drizzle-orm/pg-core';
import { zoneType } from './enums';

/** พิกัดใช้ geometry SRID 4326 (lat/lng องศา) ตรงกับที่ GPS ในแอปส่งมา */
export const point = (name: string) => geometry(name, { type: 'point', mode: 'xy', srid: 4326 });

/** product-spec §1 §7 */
export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: zoneType('type').notNull(),
  /** ขอบเขตโซนเป็น polygon ซึ่ง drizzle ยังไม่มี type ให้ สร้างคอลัมน์นี้ในไฟล์ */
  boundaryGeojson: jsonb('boundary_geojson').notNull(),
  /** จุดศูนย์กลางโซน ใช้หาโซนที่ใกล้ที่สุดแบบเร็ว ๆ ก่อนค่อยเช็ค polygon จริง */
  center: point('center').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  /** ข้อมูลรูปแบบดีมานด์เฉพาะโซนนี้ เช่น ช่วงปิดยาว ชั่วโมงพีค */
  demandConfig: jsonb('demand_config').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
