import 'dotenv/config';
import type { Config } from 'drizzle-kit';

/**
 * DATABASE_URL มาจากหน้า Supabase → Project Settings → Database → Connection string
 * ใช้ตัวที่เป็น **direct connection** (พอร์ต 5432) สำหรับ migration
 * ส่วนตอนแอปรันจริงให้ใช้ pooler (พอร์ต 6543) — migration ผ่าน pooler จะพังเพราะไม่มี session state
 */
/**
 * ล้มทันทีพร้อมบอกวิธีแก้ ดีกว่าปล่อยให้ drizzle-kit ไปตายเองด้วยข้อความ
 * "undefined is not a valid connection string" ที่อ่านแล้วไม่รู้ว่าต้องทำอะไร
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `ไม่พบ ${name} — คัดลอก .env.example เป็น .env แล้วใส่ connection string จาก Supabase\n` +
        `  cd services/core-api && cp .env.example .env`,
    );
  }
  return value;
}

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: requireEnv('DATABASE_URL'),
  },
  // PostGIS สร้างตารางของตัวเองไว้เพียบ อย่าให้ drizzle คิดว่าต้องลบทิ้ง
  extensionsFilters: ['postgis'],
  schemaFilter: ['public'],
} satisfies Config;
