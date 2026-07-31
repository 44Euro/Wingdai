import 'dotenv/config';
import type { Config } from 'drizzle-kit';

/**
 * ปลายทางฐานข้อมูลสำหรับ drizzle-kit (studio / push)
 *
 * **เลือก pooler ก่อน direct connection** ด้วยกติกาเดียวกับ src/db/client.ts
 * โฮสต์ direct ของ Supabase (`db.<ref>.supabase.co`) มีแต่ IPv6 และเน็ตหลายที่ในไทย
 * ไม่มี IPv6 transit จริง จะได้ CONNECT_TIMEOUT ที่ดูเหมือนฐานล่มทั้งที่ฐานปกติดี
 *
 * เคยคอมเมนต์ไว้ว่า migration ผ่าน pooler จะพังเพราะไม่มี session state — ไม่จริง
 * DDL ของโปรเจกต์นี้เป็นคำสั่งที่จบในตัวทุกอัน `npm run db:setup` ผ่าน pooler สำเร็จแล้ว
 */
function connectionString(): string {
  const value = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      'ไม่พบ DATABASE_URL — คัดลอก .env.example เป็น .env แล้วใส่ connection string จาก Supabase\n' +
        '  cd services/core-api && cp .env.example .env',
    );
  }
  return value;
}

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString(),
  },
  // PostGIS สร้างตารางของตัวเองไว้เพียบ อย่าให้ drizzle คิดว่าต้องลบทิ้ง
  extensionsFilters: ['postgis'],
  schemaFilter: ['public'],
} satisfies Config;
