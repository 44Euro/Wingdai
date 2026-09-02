import 'dotenv/config';
import { createScriptClient } from './client';

/** ล้างฐานสาธิตให้กลับไปว่างเปล่า ใช้คู่กับ seed เสมอ (`npm run db:reset -- --yes`) */
const client = createScriptClient();

/**
 * ตารางของแอปอยู่ใน schema `public` ล้วน ๆ ส่วน migration ของ drizzle กับตารางของ Supabase
 * อยู่คนละ schema จึงไม่โดน ตารางใหม่ที่เพิ่มทีหลังก็ถูกกวาดเองโดยไม่ต้องมาแก้ไฟล์นี้
 *
 * ยกเว้นตารางที่เป็นของ extension บน Supabase นั้น PostGIS อยู่ schema `extensions` จึงรอด
 * แต่อิมเมจ postgis ที่ใช้ตอนรันในเครื่องกับใน CI ติดตั้งมาไว้ที่ `public` เลย
 * ถ้ากวาดไปด้วยจะล้าง `spatial_ref_sys` เกลี้ยง แล้วคิวรีระยะทางทุกอันตอบ
 * "Cannot find SRID (4326)" ทั้งที่ตาราง seed กลับมาครบดูเหมือนไม่มีอะไรผิด
 */
async function tableNames(): Promise<string[]> {
  const rows = await client<{ table_name: string }[]>`
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (
        select 1 from pg_depend d
        where d.objid = c.oid and d.deptype = 'e'
      )
    order by c.relname`;
  return rows.map((r) => r.table_name);
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('ลบข้อมูลทั้งฐาน ถ้าตั้งใจจริงให้สั่ง: npm run db:reset -- --yes');
    process.exit(1);
  }

  const [target] = await client<{ host: string; database: string }[]>`
    select inet_server_addr()::text as host, current_database() as database`;
  console.log(`ฐานเป้าหมาย ${target?.database} @ ${target?.host}`);

  const tables = await tableNames();
  const [before] = await client<{ n: number }[]>`select count(*)::int as n from accounts`;
  console.log(`${tables.length} ตาราง · บัญชีก่อนล้าง ${before?.n ?? 0}`);

  const list = tables.map((t) => `"public"."${t}"`).join(', ');

  /**
   * API ที่ deploy อยู่ยังรับคำขอระหว่างที่เราล้าง คิวรีของมันถือล็อกแถวคาไว้
   * truncate ขอล็อกทั้งตารางจึงชน postgres เลือกฆ่าฝั่งเราแล้วตอบ deadlock detected
   * ล็อกพวกนั้นหลุดเองในไม่กี่วินาที ถอยแล้วลองใหม่จึงผ่าน
   */
  for (let attempt = 1; ; attempt += 1) {
    try {
      await client.unsafe(`truncate table ${list} restart identity cascade`);
      break;
    } catch (error) {
      const message = (error as Error).message;
      if (attempt >= 4 || !/deadlock|lock timeout|could not obtain lock/i.test(message)) throw error;
      console.log(`  ชนล็อกกับ API (${message}) ลองใหม่ครั้งที่ ${attempt + 1}/4`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  console.log('ล้างเรียบร้อย รัน seed ต่อเพื่อใส่ข้อมูลตั้งต้นกลับเข้าไป');
  await client.end();
}

main().catch(async (error) => {
  console.error('reset ล้มเหลว:', (error as Error).message);
  await client.end();
  process.exit(1);
});
