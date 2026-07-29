import 'dotenv/config';
import type postgres from 'postgres';
import { createScriptClient } from './client';

/** ยิงของจริงใส่ฐานเพื่อพิสูจน์ว่า trigger กับ constraint ทำงานจริง */
const client = createScriptClient();

let passed = 0;
let failed = 0;

/** คาดว่าคำสั่งชุดนี้ต้องถูกฐานปฏิเสธ ด้วยเหตุผลที่ระบุ */
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

/** ชื่อผู้ใช้และเบอร์ที่ไม่ซ้ำใครในแต่ละครั้งที่เรียก */
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
  commission_rate_bp: 1500,
  payment_method: 'promptpay',
  // R11 NOT NULL ตั้งแต่คลื่น 1 fixture เดิมไม่ได้ใส่ ทำให้เช็คสี่ข้อล้มด้วยเหตุผลผิด
  delivery_pin: '1234',
  ...over,
});

async function main() {
  console.log('\nledger (product-spec §6.2)');

  await mustAllow('เขียนกลุ่มที่บาลานซ์ได้', async (tx) => {
    const g = crypto.randomUUID();
    await tx`insert into ledger_entries ${tx([
      { entry_group_id: g, account: 'cash', debit_satang: 17000, credit_satang: 0, reason: 'test' },
      { entry_group_id: g, account: 'platform_revenue', debit_satang: 0, credit_satang: 17000, reason: 'test' },
    ])}`;
    // constraint แบบ deferred จะทำงานตอน COMMIT สั่ง IMMEDIATE เพื่อให้ตรวจเดี๋ยวนี้
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

  console.log('\nกฎออร์เดอร์ (product-spec §4.3 · §6.1)');

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

  await mustReject('ยอดคอมที่ไม่ตรงกับอัตราที่บันทึกไว้ถูกตีกลับ', 'orders_commission_matches_rate', async (tx) => {
    const s = await seed(tx);
    await tx`insert into orders ${tx(order(s, { commission_satang: 0 }))}`;
  });

  /** อัตราอื่นต้องผ่านได้ ตราบใดที่ยอดตรงกับอัตรานั้น นี่คือสิ่งที่ SA6 ต้องการ */
  await mustAllow('อัตราอื่นผ่านได้ถ้ายอดตรงกับอัตรานั้น', async (tx) => {
    const s = await seed(tx);
    await tx`insert into orders ${tx(order(s, {
      commission_rate_bp: 1200,
      commission_satang: Math.floor((15000 * 1200) / 10000),
    }))}`;
  });

  console.log('\nกฎบัญชีผู้ใช้ (product-spec §4.3 · §7)');

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
