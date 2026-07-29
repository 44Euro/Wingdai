import 'dotenv/config';
import type { Config } from 'drizzle-kit';

/** ปลายทางฐานข้อมูลสำหรับ drizzle-kit (studio / push) */
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
