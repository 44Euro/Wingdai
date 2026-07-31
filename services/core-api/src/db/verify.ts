import 'dotenv/config';
import type postgres from 'postgres';
import { createScriptClient } from './client';

/**
 * ยิงของจริงใส่ฐานเพื่อพิสูจน์ว่า trigger กับ constraint ทำงานจริง
 * ไม่ใช่แค่ CREATE ผ่านแล้วเชื่อว่าใช้ได้ — ทุกเคสจบด้วย rollback ไม่ทิ้งขยะไว้
 *
 * claude.md §6.2 บอกว่า ledger ผิดคือปัญหาการเงิน สิ่งที่กันไว้จึงต้องมีคนลองพังดูจริง
 */
const client = createScriptClient();

let passed = 0;
let failed = 0;

/**
 * คาดว่าคำสั่งชุดนี้ต้องถูกฐานปฏิเสธ **ด้วยเหตุผลที่ระบุ**
 *
 * `expect` สำคัญไม่แพ้ตัวการทดสอบเอง — เคยเจอมาแล้วว่าข้อมูลทดสอบไปชนกับ unique index
 * แล้วทุกข้อขึ้น ✓ ทั้งที่ trigger ที่ตั้งใจจะตรวจไม่เคยถูกเรียกเลยสักครั้ง
 * ถ้าไม่เทียบข้อความ ตัวตรวจก็แค่ยืนยันว่า "มี error สักอย่าง" ซึ่งไม่ได้พิสูจน์อะไร
 */
async function mustReject(
  label: string,
  expect: string,
  body: (tx: postgres.TransactionSql) => Promise<unknown>,
) {
  try {
    await client.begin(async (tx) => {
      await body(tx);
      throw new Error('__NOT_REJECTED__');
    });
    console.log(`  ✗ ${label} — ฐานยอมให้ทำ ทั้งที่ไม่ควร`);
    failed += 1;
  } catch (error) {
    const message = (error as Error).message;
    if (message === '__NOT_REJECTED__') {
      console.log(`  ✗ ${label} — ฐานยอมให้ทำ ทั้งที่ไม่ควร`);
      failed += 1;
    } else if (!message.includes(expect)) {
      console.log(`  ✗ ${label} — ถูกตีกลับด้วยเหตุผลอื่น: ${message.split('\n')[0]}`);
      failed += 1;
    } else {
      console.log(`  ✓ ${label}`);
      passed += 1;
    }
  }
}

async function mustAllow(label: string, body: (tx: postgres.TransactionSql) => Promise<unknown>) {
  try {
    await client.begin(async (tx) => {
      await body(tx);
      throw new Error('__ROLLBACK__');
    });
    console.log(`  ✗ ${label}`);
    failed += 1;
  } catch (error) {
    if ((error as Error).message === '__ROLLBACK__') {
      console.log(`  ✓ ${label}`);
      passed += 1;
    } else {
      console.log(`  ✗ ${label} — ${(error as Error).message.split('\n')[0]}`);
      failed += 1;
    }
  }
}

/**
 * ชื่อผู้ใช้และเบอร์ที่ไม่ซ้ำใครในแต่ละครั้งที่เรียก
 *
 * ก่อนหน้านี้ใช้ค่าคงที่ ('cust1' / '0812345678') แล้วไปชนกับข้อมูลจาก npm run db:seed
 * ผลคือ mustReject ทุกข้อขึ้น ✓ เพราะติด unique index ไม่ใช่เพราะ trigger ทำงาน
 */
let counter = 0;
const uniq = () => `${Date.now() % 100000000}${(counter += 1)}`.slice(-8).padStart(8, '0');

/** สร้างข้อมูลตั้งต้นครบชุดหนึ่งออร์เดอร์ คืน id ที่ต้องใช้ต่อ */
async function seed(tx: postgres.TransactionSql) {
  const [zone] = await tx`
    insert into zones (name, type, boundary_geojson, center)
    values ('โซนทดสอบ', 'mixed', '{}'::jsonb, st_setsrid(st_point(100.54, 13.78), 4326))
    returning id`;
  const [customer] = await tx`
    insert into accounts (account_type, username, password_hash, full_name, phone)
    values ('user', ${`t_cust_${uniq()}`}, 'x', 'ลูกค้า', ${`09${uniq()}`}) returning id`;
  const [owner] = await tx`
    insert into accounts (account_type, username, password_hash, full_name, phone)
    values ('user', ${`t_owner_${uniq()}`}, 'x', 'เจ้าของร้าน', ${`09${uniq()}`}) returning id`;
  const [restaurant] = await tx`
    insert into restaurants (owner_user_id, zone_id, name, cuisine, address_text, location, prep_time_minutes)
    values (${owner!.id}, ${zone!.id}, 'ครัวมาลี', 'rice', 'ซอยอารีย์ 1',
            st_setsrid(st_point(100.54, 13.78), 4326), 12)
    returning id`;
  const [address] = await tx`
    insert into addresses (account_id, label, address_text, location)
    values (${customer!.id}, 'บ้าน', 'ซอยอารีย์ 3', st_setsrid(st_point(100.545, 13.782), 4326))
    returning id`;
  return { zone: zone!.id, customer: customer!.id, owner: owner!.id, restaurant: restaurant!.id, address: address!.id };
}

const order = (s: Awaited<ReturnType<typeof seed>>, over: Record<string, unknown> = {}) => ({
  reference: `WD-${Math.random().toString(36).slice(2, 8)}`,
  customer_id: s.customer,
  restaurant_id: s.restaurant,
  zone_id: s.zone,
  delivery_address_id: s.address,
  food_total_satang: 15000,
  delivery_fee_satang: 1500,
  service_fee_satang: 500,
  commission_satang: 2250, // 15% ของ 15000
  payment_method: 'promptpay',
  ...over,
});

async function main() {
  console.log('\nledger (claude.md §6.2)');

  await mustAllow('เขียนกลุ่มที่บาลานซ์ได้', async (tx) => {
    const g = crypto.randomUUID();
    await tx`insert into ledger_entries ${tx([
      { entry_group_id: g, account: 'cash', debit_satang: 17000, credit_satang: 0, reason: 'test' },
      { entry_group_id: g, account: 'platform_revenue', debit_satang: 0, credit_satang: 17000, reason: 'test' },
    ])}`;
    // constraint แบบ deferred จะทำงานตอน COMMIT — สั่ง IMMEDIATE เพื่อให้ตรวจเดี๋ยวนี้
    // จะได้ทดสอบได้โดยไม่ต้อง commit จริงแล้วมาตามเก็บกวาดทีหลัง
    await tx`set constraints all immediate`;
  });

  await mustReject('กลุ่มที่ไม่บาลานซ์ถูกตีกลับตอน commit', 'ไม่บาลานซ์', async (tx) => {
    const g = crypto.randomUUID();
    await tx`insert into ledger_entries ${tx([
      { entry_group_id: g, account: 'cash', debit_satang: 17000, credit_satang: 0, reason: 'test' },
      { entry_group_id: g, account: 'platform_revenue', debit_satang: 0, credit_satang: 16999, reason: 'test' },
    ])}`;
    await tx`set constraints all immediate`;
  });

  await mustReject('แก้แถว ledger ไม่ได้', 'เขียนอย่างเดียว', async (tx) => {
    const g = crypto.randomUUID();
    await tx`insert into ledger_entries ${tx([
      { entry_group_id: g, account: 'cash', debit_satang: 100, credit_satang: 0, reason: 'test' },
      { entry_group_id: g, account: 'platform_revenue', debit_satang: 0, credit_satang: 100, reason: 'test' },
    ])}`;
    await tx`update ledger_entries set debit_satang = 999 where entry_group_id = ${g}`;
  });

  await mustReject('ลบแถว ledger ไม่ได้', 'เขียนอย่างเดียว', async (tx) => {
    const g = crypto.randomUUID();
    await tx`insert into ledger_entries ${tx([
      { entry_group_id: g, account: 'cash', debit_satang: 100, credit_satang: 0, reason: 'test' },
      { entry_group_id: g, account: 'platform_revenue', debit_satang: 0, credit_satang: 100, reason: 'test' },
    ])}`;
    await tx`delete from ledger_entries where entry_group_id = ${g}`;
  });

  await mustReject('แถวเดียวเป็นทั้งเดบิตและเครดิตไม่ได้', 'ledger_entries_one_side_only', async (tx) => {
    await tx`insert into ledger_entries ${tx([
      { entry_group_id: crypto.randomUUID(), account: 'cash', debit_satang: 100, credit_satang: 100, reason: 'test' },
    ])}`;
  });

  console.log('\nกฎออร์เดอร์ (claude.md §4.3 · §6.1)');

  await mustAllow('ลูกค้าทั่วไปสั่งร้านอื่นได้', async (tx) => {
    const s = await seed(tx);
    await tx`insert into orders ${tx(order(s))}`;
  });

  await mustReject('สั่งอาหารจากร้านตัวเองไม่ได้', 'ร้านของตัวเอง', async (tx) => {
    const s = await seed(tx);
    await tx`insert into orders ${tx(order(s, { customer_id: s.owner }))}`;
  });

  await mustReject('ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้', 'orders_rider_is_not_customer', async (tx) => {
    const s = await seed(tx);
    await tx`insert into orders ${tx(order(s, { rider_id: s.customer }))}`;
  });

  await mustReject('คอมมิชชันไม่ใช่ 15% ถูกตีกลับ', 'orders_commission_is_15_percent', async (tx) => {
    const s = await seed(tx);
    await tx`insert into orders ${tx(order(s, { commission_satang: 0 }))}`;
  });

  console.log('\nกฎบัญชีผู้ใช้ (claude.md §4.3 · §7)');

  await mustReject('บัญชี rider เป็นเจ้าของร้านไม่ได้', 'เจ้าของร้านต้องเป็นบัญชีประเภท user', async (tx) => {
    const s = await seed(tx);
    const [rider] = await tx`
      insert into accounts (account_type, username, password_hash, full_name, phone)
      values ('rider', ${`t_rider_${uniq()}`}, 'x', 'ไรเดอร์', ${`09${uniq()}`}) returning id`;
    await tx`
      insert into restaurants (owner_user_id, zone_id, name, cuisine, address_text, location, prep_time_minutes)
      values (${rider!.id}, ${s.zone}, 'ร้านไรเดอร์', 'rice', 'ที่ไหนสักแห่ง',
              st_setsrid(st_point(100.54, 13.78), 4326), 10)`;
  });

  await mustReject('เบอร์โทรผิดรูปแบบสมัครไม่ได้', 'accounts_phone_format', async (tx) => {
    await tx`insert into accounts (account_type, username, password_hash, full_name, phone)
             values ('user', ${`t_bad_${uniq()}`}, 'x', 'เบอร์ผิด', '123')`;
  });

  console.log(`\nผ่าน ${passed} · ไม่ผ่าน ${failed}\n`);
  await client.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('ตรวจไม่สำเร็จ:', e.message);
  await client.end();
  process.exit(1);
});
