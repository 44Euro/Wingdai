import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createScriptClient } from './client';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/**
 * ตั้งฐานข้อมูลให้พร้อมใช้ ทำได้ซ้ำกี่รอบก็ได้ ผลลัพธ์เหมือนเดิม
 *
 *   1. ติดตั้ง PostGIS  — ต้องมาก่อน migration เพราะ 0000 ใช้ชนิด geometry
 *      (drizzle-kit generate ไม่รู้จักเรื่องนี้ ใส่ให้เองไม่ได้)
 *   2. รัน migration ของ drizzle
 *   3. ลง trigger/constraint ใน guards.sql ที่ generate ให้ไม่ได้
 *      (ไฟล์นี้อยู่นอก journal ของ drizzle ตั้งใจ — เขียนให้รันซ้ำได้ จะได้ลงทับได้ทุกครั้ง
 *       และไม่ต้องคอยเลี่ยงชื่อชนกับ migration ที่ generate มาใหม่)
 *
 * ใช้สคริปต์นี้แทน `drizzle-kit migrate` เพราะ CLI ตัวนั้นกลืน error แล้วจบด้วย exit 0
 * ทั้งที่ไม่ได้สร้างอะไรเลย — เสียเวลาไล่หาสาเหตุนาน
 */
async function main() {
  const client = createScriptClient();

  try {
    console.log('1/3 ติดตั้ง PostGIS…');
    await client.unsafe(`
      create schema if not exists extensions;
      create extension if not exists postgis with schema extensions;
    `);
    const [v] = await client.unsafe(`select extversion from pg_extension where extname = 'postgis'`);
    console.log('    PostGIS', v?.extversion);

    console.log('2/3 รัน migration…');
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });

    console.log('3/3 ลง trigger กับ constraint…');
    await client.unsafe(await readFile('./drizzle/guards.sql', 'utf8'));

    console.log('เสร็จเรียบร้อย');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('ล้มเหลว:', error.message);
  if (error.query) console.error('คำสั่งที่พัง:\n', String(error.query).trim().slice(0, 400));
  process.exit(1);
});
