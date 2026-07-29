import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, jsonb, geometry } from 'drizzle-orm/pg-core';
import { zoneType } from './enums';

/**
 * พิกัดใช้ geometry SRID 4326 (lat/lng องศา) ตรงกับที่ GPS ในแอปส่งมา
 *
 * ไม่ใช้ geography เพราะ customType ของ drizzle ใส่เครื่องหมายคำพูดครอบชื่อ type
 * ทำให้ SQL ที่ generate ออกมารันไม่ผ่าน — geometry เป็น type ที่ drizzle รองรับในตัว
 * เวลาต้องการระยะทางเป็นเมตรให้ cast ตอน query: ST_DWithin(location::geography, ...)
 */
export const point = (name: string) => geometry(name, { type: 'point', mode: 'xy', srid: 4326 });

/**
 * claude.md §1 · §7
 *
 * โซนคือหน่วยของทั้งธุรกิจ — ค่าส่ง การจ่ายงาน และการวัดผลผูกกับโซนทั้งหมด
 * ห้ามทำเป็นตารางเดียวครอบทั้งเมือง
 *
 * `type` มีไว้ให้แอดมินกรองและดูรายงาน **ห้ามเอาไปเขียน if ใน dispatch**
 * เรื่องช่วงปิด/ชั่วโมงพีคให้เก็บใน demandConfig ของโซนนั้น ๆ ไม่ใช่แตกตามชนิดโซน
 */
export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: zoneType('type').notNull(),
  /**
   * ขอบเขตโซนเป็น polygon ซึ่ง drizzle ยังไม่มี type ให้ — สร้างคอลัมน์นี้ในไฟล์
   * drizzle/0001_guards.sql เอง แล้วบอก drizzle ให้มองข้ามผ่าน tablesFilter ไม่ได้
   * จึงประกาศเป็น jsonb ตรงนี้ไว้ก่อน แล้ว ALTER เป็น geometry(Polygon,4326) ใน migration
   */
  boundaryGeojson: jsonb('boundary_geojson').notNull(),
  /** จุดศูนย์กลางโซน ใช้หาโซนที่ใกล้ที่สุดแบบเร็ว ๆ ก่อนค่อยเช็ค polygon จริง */
  center: point('center').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  /**
   * ข้อมูลรูปแบบดีมานด์เฉพาะโซนนี้ เช่น ช่วงปิดยาว ชั่วโมงพีค
   * เป็น jsonb เพราะรูปแบบต่างกันไปตามโซน และเป็นข้อมูล ไม่ใช่ตรรกะ
   */
  demandConfig: jsonb('demand_config').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
