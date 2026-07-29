import type { Config } from 'drizzle-kit';

/**
 * DATABASE_URL มาจากหน้า Supabase → Project Settings → Database → Connection string
 * ใช้ตัวที่เป็น **direct connection** (พอร์ต 5432) สำหรับ migration
 * ส่วนตอนแอปรันจริงให้ใช้ pooler (พอร์ต 6543) — migration ผ่าน pooler จะพังเพราะไม่มี session state
 */
export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // PostGIS สร้างตารางของตัวเองไว้เพียบ อย่าให้ drizzle คิดว่าต้องลบทิ้ง
  extensionsFilters: ['postgis'],
  schemaFilter: ['public'],
} satisfies Config;
