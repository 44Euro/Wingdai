import postgres from 'postgres';

/**
 * คอนเนกชันสำหรับ "สคริปต์" (seed / verify / setup / smoke) — คนละตัวกับของแอปใน db.module.ts
 * แต่ต้องเลือกปลายทางด้วยกติกาเดียวกัน ไม่งั้นสคริปต์กับแอปจะคุยคนละฐานโดยไม่รู้ตัว
 *
 * **ทำไมต้องเผื่อ pooler ทั้งที่ DATABASE_URL ก็ต่อได้**
 * โฮสต์ direct connection ของ Supabase (`db.<ref>.supabase.co`) มีแต่ IPv6
 * เน็ตบ้าน/ออฟฟิศไทยหลายที่ไม่มี IPv6 transit จริง → ได้ CONNECT_TIMEOUT ที่ดูเหมือนฐานล่ม
 * ส่วน pooler (`*.pooler.supabase.com`) มี IPv4 จึงต่อได้ทุกที่
 */
export function createScriptClient(opts: { max?: number } = {}) {
  const url = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('ต้องตั้ง DATABASE_URL หรือ DATABASE_POOL_URL ใน .env ก่อน');

  // pooler ทำงานแบบ transaction mode ไม่มี session state ให้เก็บ prepared statement
  const throughPooler = url.includes('pooler.supabase.com');

  return postgres(url, {
    max: opts.max ?? 1,
    ssl: 'require',
    prepare: !throughPooler,
    // Supabase วาง PostGIS ไว้ที่ schema `extensions` — ไม่ใส่ตรงนี้จะอ้างชนิด geometry ไม่เจอ
    connection: { search_path: 'public,extensions' },
    onnotice: () => {},
  });
}
