/** สร้างบักเก็ตสองตัว รันครั้งเดียวตอนตั้งโปรเจกต์ รันซ้ำได้ไม่พัง */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env ก่อน');
  process.exit(1);
}

const BUCKETS = [
  { name: 'rider-docs', public: false },
  { name: 'public-media', public: true },
] as const;

async function main() {
  const client = createClient(url!, key!, { auth: { persistSession: false } });

  for (const bucket of BUCKETS) {
    const { error } = await client.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: '8MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    });

    // มีอยู่แล้วไม่ใช่ความผิดพลาด สคริปต์นี้ต้องรันซ้ำได้
    const already = error?.message?.toLowerCase().includes('already exists');
    console.log(`${bucket.name.padEnd(14)} ${error ? (already ? 'มีอยู่แล้ว' : `พลาด: ${error.message}`) : 'สร้างแล้ว'}`);
    if (error && !already) process.exitCode = 1;
  }

  const { data } = await client.storage.listBuckets();
  console.log('\nบักเก็ตทั้งหมดตอนนี้:');
  for (const b of data ?? []) console.log(`  ${b.name.padEnd(14)} ${b.public ? 'เปิด' : 'ปิด'}`);
}

void main();
