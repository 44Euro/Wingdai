import postgres from 'postgres';
import { sslMode } from './sslMode';

/** คอนเนกชันสำหรับ "สคริปต์" (seed / verify / setup / smoke) คนละตัวกับของแอปใน db.module.ts */
export function createScriptClient(opts: { max?: number } = {}) {
  const url = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('ต้องตั้ง DATABASE_URL หรือ DATABASE_POOL_URL ใน .env ก่อน');

  // pooler ทำงานแบบ transaction mode ไม่มี session state ให้เก็บ prepared statement
  const throughPooler = url.includes('pooler.supabase.com');

  return postgres(url, {
    max: opts.max ?? 1,
    ssl: sslMode(url),
    prepare: !throughPooler,
    // Supabase วาง PostGIS ไว้ที่ schema `extensions` ไม่ใส่ตรงนี้จะอ้างชนิด geometry ไม่เจอ
    connection: { search_path: 'public,extensions' },
    onnotice: () => {},
  });
}
