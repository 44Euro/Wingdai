import 'dotenv/config';
import { createScriptClient } from './client';

/** ล้างฐานสาธิตให้กลับไปว่างเปล่า ใช้คู่กับ seed เสมอ (`npm run db:reset -- --yes`) */
const client = createScriptClient();

/**
 * ตารางของแอปอยู่ใน schema `public` ล้วน ๆ ส่วน migration ของ drizzle กับตารางของ Supabase
 * อยู่คนละ schema จึงไม่โดน ตารางใหม่ที่เพิ่มทีหลังก็ถูกกวาดเองโดยไม่ต้องมาแก้ไฟล์นี้
 */
async function tableNames(): Promise<string[]> {
  const rows = await client<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`;
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
