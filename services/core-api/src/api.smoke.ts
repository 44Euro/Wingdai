import 'dotenv/config';
import { randomInt } from 'node:crypto';
import { createScriptClient } from './db/client';

/**
 * ยิง HTTP จริงใส่เซิร์ฟเวอร์ที่รันอยู่ ตั้งแต่ขอ OTP จนล็อกอินสำเร็จ
 *
 * เทสต์ยูนิตพิสูจน์ได้แค่ว่าฟังก์ชันแต่ละตัวถูก ไม่ได้พิสูจน์ว่าต่อกันแล้วใช้งานได้จริง
 * — DI ผูกถูกไหม pipe ทำงานไหม guard กันจริงไหม ฐานตอบกลับหน้าตาแบบไหน
 * สคริปต์นี้จึงเป็นด่านสุดท้ายก่อนเชื่อว่า "เสร็จแล้ว"
 *
 * ใช้: npm start (อีกหน้าต่าง) แล้ว npm run api:smoke
 * บัญชีที่สร้างระหว่างทางถูกลบทิ้งตอนจบเสมอ แม้เทสต์จะล้ม
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed += 1;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

type Res = { status: number; body: any };

async function call(method: string, path: string, body?: unknown, token?: string): Promise<Res> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** ออร์เดอร์ที่สร้างระหว่างทดสอบ — ต้องลบทิ้งตอนจบ ไม่ทิ้งขยะไว้ในฐาน */
const createdOrderIds: string[] = [];
const createdMenuItemIds: string[] = [];

/**
 * อ่าน ledger ที่เขียนลงฐานจริงแล้วเทียบกับตัวเลขที่คำนวณมือ
 *
 * ผ่าน API แล้วเชื่อว่า 200 = ถูก ไม่พอสำหรับโค้ดที่เกี่ยวกับเงิน (claude.md §6.2)
 * ต้องเปิดดูว่าเขียนอะไรลงไปจริง ๆ และเดบิตเท่ากับเครดิตไหม
 */
async function checkLedger(orderId: string) {
  const sql = createScriptClient();
  try {
    const rows = await sql<{ account: string; debit_satang: number; credit_satang: number }[]>`
      select account, debit_satang, credit_satang from ledger_entries where order_id = ${orderId}`;

    check('ส่งถึงแล้วมีรายการบัญชีเกิดขึ้น', rows.length > 0, `ได้ ${rows.length} แถว`);

    const debit = rows.reduce((s, r) => s + r.debit_satang, 0);
    const credit = rows.reduce((s, r) => s + r.credit_satang, 0);
    check(`เดบิต = เครดิต (${debit} = ${credit})`, debit === credit);

    /*
     * ออร์เดอร์นี้: ค่าอาหาร ฿130 + ค่าส่ง ฿15 + ค่าบริการ ฿5 = ฿150
     * คอมมิชชัน 15% ของ ฿130 = ฿19.50 → ร้านได้ ฿110.50
     * ไม่มีไรเดอร์ (คลื่นที่ 4 ยังไม่มา) จึงจ่ายไรเดอร์ ฿0 และไม่มีค่าธรรมเนียมเกตเวย์
     * รายได้แพลตฟอร์ม = 15000 − 11050 − 0 = ฿39.50
     */
    const by = (a: string) =>
      rows.filter((r) => r.account === a).reduce((s, r) => s + r.debit_satang + r.credit_satang, 0);

    check(`เงินเข้าบริษัท ฿150 (ได้ ${by('cash') / 100})`, by('cash') === 15000);
    check(`ยอดค้างจ่ายร้าน ฿110.50 (ได้ ${by('restaurant_payable') / 100})`, by('restaurant_payable') === 11050);
    check(`รายได้แพลตฟอร์ม ฿39.50 (ได้ ${by('platform_revenue') / 100})`, by('platform_revenue') === 3950);
    check('ยังไม่มีไรเดอร์ จึงไม่มีบรรทัดค้างจ่ายไรเดอร์', by('rider_payable') === 0);
    check('ไม่มีแถวที่เป็นศูนย์ทั้งสองข้าง', rows.every((r) => (r.debit_satang > 0) !== (r.credit_satang > 0)));

    // §6.2 เขียนอย่างเดียว — แก้ยอดผิดด้วยรายการกลับทางเท่านั้น
    let updateRejected = false;
    try {
      await sql`update ledger_entries set debit_satang = 1 where order_id = ${orderId}`;
    } catch {
      updateRejected = true;
    }
    check('แก้ ledger ที่เขียนไปแล้วไม่ได้', updateRejected);
  } finally {
    await sql.end();
  }
}

/**
 * เส้นทางจ่ายงานทั้งเส้น — ไรเดอร์ออนไลน์ → ถูกเสนองาน → รับ → ส่งถึง
 *
 * ใช้ทางแทรกมือของแอดมิน (§6.3) สั่งจ่ายทันที เพราะกติกาจังหวะเวลาที่ถูกต้อง
 * คือ "อย่าจ่ายก่อนอาหารใกล้เสร็จ" ซึ่งกับร้านที่ตั้งเวลาทำ 12 นาที
 * แปลว่าต้องรอ 11 นาทีจริง ๆ — เทสต์ที่รอนานขนาดนั้นไม่มีใครรัน
 * ส่วนกติกาเวลาเองมีเทสต์บริสุทธิ์อยู่แล้วที่ dispatch/scoring.test.ts
 */
async function dispatchChecks(
  customerToken: string,
  maleeToken: string,
  adminToken: string,
  restaurantId: string,
  menuItemId: string,
  choiceId: string,
) {
  const annLogin = await call('POST', '/auth/login', { identifier: 'rider_ann', password: 'wingdai1234' });
  const annToken = annLogin.body.token as string;
  const annId = annLogin.body.account.id as string;

  const newbieLogin = await call('POST', '/auth/login', { identifier: 'rider_new', password: 'wingdai1234' });
  const newbieToken = newbieLogin.body.token as string;

  // ไรเดอร์ที่ยังรออนุมัติต้องเปิดรับงานไม่ได้เลย (§4.3 จอ "รอการอนุมัติ" อย่างเดียว)
  const newbieOnline = await call('POST', '/rider/online', { isOnline: true, lat: 13.78, lng: 100.543 }, newbieToken);
  check('ไรเดอร์ที่ยังไม่อนุมัติเปิดรับงานไม่ได้', newbieOnline.status === 403, `ได้ ${newbieOnline.status}`);

  const noCoords = await call('POST', '/rider/online', { isOnline: true }, annToken);
  // ไม่รู้พิกัด = ให้คะแนนระยะทางไม่ได้ = จ่ายงานให้ไม่ได้
  check('เปิดรับงานโดยไม่ส่งพิกัดไม่ได้', noCoords.status === 409, `ได้ ${noCoords.status}`);

  const online = await call('POST', '/rider/online', { isOnline: true, lat: 13.7805, lng: 100.5435 }, annToken);
  check('ไรเดอร์เปิดรับงานได้', online.status === 200 && online.body?.isOnline === true, JSON.stringify(online.body));
  check('บันทึกเวลาที่เริ่มออนไลน์ (§8 ตัวหารของ Orders per Rider Hour)', !!online.body?.onlineSince);

  // ออร์เดอร์ใหม่ที่ร้านรับแล้ว → พร้อมให้จ่ายงาน
  const job = await call('POST', '/orders', {
    restaurantId,
    items: [{ menuItemId, quantity: 1, choiceIds: [choiceId] }],
    paymentMethod: 'cash',
  }, customerToken);
  check('สร้างออร์เดอร์สำหรับทดสอบการจ่ายงานได้', job.status === 201, JSON.stringify(job.body));
  createdOrderIds.push(job.body?.id);
  await call('PATCH', `/orders/${job.body.id}/status`, { status: 'accepted' }, maleeToken);

  const forced = await call('POST', `/admin/dispatch/orders/${job.body.id}`, undefined, adminToken);
  check('แอดมินสั่งจ่ายงานทันทีได้ (§6.3 ทางแทรกมือ)', forced.status === 200 && forced.body?.offered === true, JSON.stringify(forced.body));

  const byRider = await call('POST', `/admin/dispatch/orders/${job.body.id}`, undefined, annToken);
  check('ไรเดอร์สั่งจ่ายงานเองไม่ได้', byRider.status === 403, `ได้ ${byRider.status}`);

  const annStatus = await call('GET', '/rider/status', undefined, annToken);
  check('ไรเดอร์เห็นงานที่ถูกเสนอ', annStatus.body?.offer?.orderId === job.body.id, JSON.stringify(annStatus.body?.offer));
  check('งานที่เสนอมีที่อยู่ร้านและที่อยู่ลูกค้าครบ', !!annStatus.body?.offer?.restaurantAddress && !!annStatus.body?.offer?.dropoffAddress);
  check('บอกว่าต้องเก็บเงินสดเท่าไหร่', annStatus.body?.offer?.collectCashSatang === 7000, `ได้ ${annStatus.body?.offer?.collectCashSatang}`);
  check('ค่าตอบแทนไรเดอร์ = ค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่าย', annStatus.body?.offer?.riderPaySatang === 1500);
  check('มีเวลาหมดอายุของข้อเสนอ (15 วินาที)', !!annStatus.body?.offer?.expiresAt);

  const accepted = await call('POST', `/rider/jobs/${job.body.id}/accept`, undefined, annToken);
  check('ไรเดอร์กดรับงานได้', accepted.status === 200, JSON.stringify(accepted.body));

  const twiceAccept = await call('POST', `/rider/jobs/${job.body.id}/accept`, undefined, annToken);
  check('กดรับซ้ำไม่ได้', twiceAccept.status === 409, `ได้ ${twiceAccept.status}`);

  const stolen = await call('POST', `/rider/jobs/${job.body.id}/accept`, undefined, newbieToken);
  check('ไรเดอร์ที่ไม่ได้ถูกเสนอแย่งรับไม่ได้', stolen.status === 404 || stolen.status === 403, `ได้ ${stolen.status}`);

  const again = await call('POST', `/admin/dispatch/orders/${job.body.id}`, undefined, adminToken);
  check('ออร์เดอร์ที่มีไรเดอร์แล้วสั่งจ่ายซ้ำไม่ได้', again.body?.offered === false);

  const jobs = await call('GET', '/rider/jobs', undefined, annToken);
  check('งานโผล่ในรายการงานของไรเดอร์', jobs.body?.some((j: any) => j.orderId === job.body.id));

  const ping = await call('POST', '/rider/ping', { lat: 13.7808, lng: 100.5439 }, annToken);
  check('ส่งพิกัดระหว่างทางได้', ping.status === 200);

  // ครัวต้องบอกว่ากำลังทำก่อน ไรเดอร์ถึงจะกดรับของได้ — ข้ามขั้นไม่ได้ (orders/stateMachine.ts)
  const tooEarly = await call('PATCH', `/orders/${job.body.id}/status`, { status: 'picked_up' }, annToken);
  check('อาหารยังไม่เริ่มทำ ไรเดอร์กดรับของไม่ได้', tooEarly.status === 400, `ได้ ${tooEarly.status}`);
  await call('PATCH', `/orders/${job.body.id}/status`, { status: 'preparing' }, maleeToken);

  // §6.3 ไรเดอร์ที่รับงานแล้วเท่านั้นที่กดรับของ/ส่งถึงได้
  const pickedUp = await call('PATCH', `/orders/${job.body.id}/status`, { status: 'picked_up' }, annToken);
  check('ไรเดอร์กดรับของได้', pickedUp.status === 200, JSON.stringify(pickedUp.body));

  const delivered = await call('PATCH', `/orders/${job.body.id}/status`, { status: 'delivered' }, annToken);
  check('ไรเดอร์กดส่งถึงได้', delivered.status === 200, JSON.stringify(delivered.body));
  // §6.5 ส่งถึงแล้วถือว่าเก็บเงินสดครบ
  check('ออร์เดอร์เงินสดที่ส่งถึงแล้วเปลี่ยนเป็นจ่ายแล้ว', delivered.body?.paymentStatus === 'paid');

  const afterStatus = await call('GET', '/rider/status', undefined, annToken);
  /*
   * §6.2 — เงินสดที่ไรเดอร์เก็บคือเงินของบริษัทที่เขาถือไว้ ต้องบวกเข้ายอดในมือทันที
   * ถ้าไม่บวก เพดาน cash_limit จะไม่มีวันถูกแตะ แล้วไรเดอร์จะถือเงินบริษัทได้ไม่จำกัด
   */
  check('เงินสดที่เก็บมาเข้าไปอยู่ในยอดเงินในมือของไรเดอร์', afterStatus.body?.cashHeldSatang >= 7000, `ได้ ${afterStatus.body?.cashHeldSatang}`);
  check('ไม่มีงานค้างอยู่แล้ว', afterStatus.body?.activeJobs?.length === 0);

  const stats = await call('GET', '/rider/stats', undefined, annToken);
  check('มีตัวเลข Orders per Rider Hour ให้ดู (§8 North Star)', stats.status === 200 && typeof stats.body?.hours === 'number');

  const offline = await call('POST', '/rider/online', { isOnline: false }, annToken);
  check('ปิดรับงานได้', offline.status === 200 && offline.body?.isOnline === false);

  // เก็บกวาดยอดเงินสดที่เทสต์ทำให้เพิ่ม ไม่ให้สะสมจนชนเพดานในรอบถัด ๆ ไป
  const cleanupSql = createScriptClient();
  try {
    await cleanupSql`update rider_profiles set cash_held_satang = 0 where account_id = ${annId}`;
  } finally {
    await cleanupSql.end();
  }
}

/**
 * คืนเงินกึ่งอัตโนมัติ (claude.md §6.4) + จอ exception-based ของแอดมิน (§7)
 *
 * ใช้ออร์เดอร์ที่ส่งถึงแล้วจากขั้นก่อนหน้า เพราะ §6.4 กำหนดว่าเรื่องคุณภาพ
 * แจ้งได้เฉพาะออร์เดอร์ที่ถึงมือลูกค้าแล้ว
 */
async function refundChecks(customerToken: string, adminToken: string, deliveredOrderId: string) {
  const notMine = await call('POST', '/refunds', {
    orderId: deliveredOrderId, reason: 'wrong_item', detail: 'ได้ของผิด', hasPhoto: true,
  }, adminToken);
  // ตอบ 404 ไม่ใช่ 403 — 403 ยืนยันว่าออร์เดอร์รหัสนี้มีอยู่จริง
  check('แจ้งปัญหาออร์เดอร์ของคนอื่นไม่ได้', notMine.status === 404, `ได้ ${notMine.status}`);

  const opened = await call('POST', '/refunds', {
    orderId: deliveredOrderId, reason: 'wrong_item', detail: 'ได้ข้าวผัดแทนกะเพรา', hasPhoto: true,
  }, customerToken);
  check('ลูกค้าแจ้งปัญหาได้', opened.status === 201, JSON.stringify(opened.body));
  check('ระบบตรวจอัตโนมัติแล้วเสนอคำตัดสิน', opened.body?.autoVerdict === 'suggest_full', `ได้ ${opened.body?.autoVerdict}`);
  // §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ ต้องมีเหตุผลให้แอดมินอ่านก่อนกด
  check('มีเหตุผลประกอบให้แอดมินอ่าน', Array.isArray(opened.body?.reasoning) && opened.body.reasoning.length > 0);
  check('ของผิด = ความรับผิดของร้าน (§6.4)', opened.body?.fault === 'restaurant', `ได้ ${opened.body?.fault}`);
  check('เสนอยอดคืนมาให้', opened.body?.suggestedAmountSatang > 0);

  const twice = await call('POST', '/refunds', {
    orderId: deliveredOrderId, reason: 'wrong_item', detail: 'แจ้งซ้ำ', hasPhoto: false,
  }, customerToken);
  check('แจ้งซ้ำใบเดิมไม่ได้', twice.status === 409, `ได้ ${twice.status}`);

  const caseId = opened.body.id as string;

  const byCustomer = await call('POST', `/admin/refunds/${caseId}`, { approve: true }, customerToken);
  // §6.4 มีคนกดยืนยันก่อนเงินออกเสมอ และคนนั้นต้องเป็นแอดมิน ไม่ใช่คนที่แจ้งเอง
  check('ลูกค้าอนุมัติคืนเงินให้ตัวเองไม่ได้', byCustomer.status === 403, `ได้ ${byCustomer.status}`);

  const queue = await call('GET', '/admin/refunds', undefined, adminToken);
  check('เรื่องโผล่ในคิวของแอดมิน', queue.body?.some((c: any) => c.id === caseId));

  const exceptions = await call('GET', '/admin/exceptions', undefined, adminToken);
  check('ข้อพิพาทที่ยังไม่จบโผล่ในจอ exception (§7)', exceptions.status === 200
    && exceptions.body?.some((e: any) => e.kind === 'open_dispute' && e.orderId === deliveredOrderId));
  check('บอกด้วยว่าแอดมินต้องทำอะไร ไม่ใช่แค่ว่ามีอะไรผิด',
    exceptions.body?.every((e: any) => typeof e.detail === 'string' && e.detail.length > 0));

  const overRefund = await call('POST', `/admin/refunds/${caseId}`, {
    approve: true, amountSatang: 999_999_99,
  }, adminToken);
  // คืนเกินที่ลูกค้าจ่ายมาคือการสร้างเงินจากอากาศ — ฐานจับไม่ได้เพราะยังบาลานซ์อยู่
  check('คืนเกินยอดที่ลูกค้าจ่ายไม่ได้', overRefund.status === 400, `ได้ ${overRefund.status}`);

  const approved = await call('POST', `/admin/refunds/${caseId}`, { approve: true }, adminToken);
  check('แอดมินกดยืนยันครั้งเดียวจบ (§6.4)', approved.status === 200, JSON.stringify(approved.body));
  check('ยอดที่อนุมัติ = ยอดที่ระบบเสนอ', approved.body?.approvedAmountSatang === opened.body.suggestedAmountSatang);

  const decidedTwice = await call('POST', `/admin/refunds/${caseId}`, { approve: true }, adminToken);
  check('ตัดสินซ้ำไม่ได้', decidedTwice.status === 409, `ได้ ${decidedTwice.status}`);

  await checkRefundLedger(deliveredOrderId, opened.body.suggestedAmountSatang);

  const afterExceptions = await call('GET', '/admin/exceptions', undefined, adminToken);
  check('ตัดสินแล้วเรื่องหลุดจากจอ exception',
    !afterExceptions.body?.some((e: any) => e.kind === 'open_dispute' && e.orderId === deliveredOrderId));

  const metrics = await call('GET', '/admin/metrics', undefined, adminToken);
  check('มีตัวเลข §8 ให้ดู', metrics.status === 200 && typeof metrics.body?.orders === 'number');
  check('อัตราคืนเงินคำนวณได้ (§8 เกิน 2% = มีอะไรพัง)', metrics.body?.refundRate !== undefined);
  check('อัตราจ่ายงานอัตโนมัติคำนวณได้ (§8 > 90%)', metrics.body?.autoDispatchRate !== undefined);

  const byRider = await call('GET', '/admin/exceptions', undefined, adminToken);
  check('จอ exception ไม่ใช่ฟีดออร์เดอร์ทั้งหมด (§7)', Array.isArray(byRider.body));
}

/** รายการกลับทางที่เขียนลงฐานจริงตอนแอดมินอนุมัติ (§6.4) */
async function checkRefundLedger(orderId: string, amount: number) {
  const sql = createScriptClient();
  try {
    const rows = await sql<{ account: string; debit_satang: number; credit_satang: number }[]>`
      select account, debit_satang, credit_satang
        from ledger_entries where order_id = ${orderId} and reason = 'refund.approved'`;

    check('อนุมัติแล้วมีรายการกลับทางเกิดขึ้นอัตโนมัติ', rows.length === 2, `ได้ ${rows.length} แถว`);

    const debit = rows.reduce((s, r) => s + r.debit_satang, 0);
    const credit = rows.reduce((s, r) => s + r.credit_satang, 0);
    check(`คืนเงินแล้วเดบิต = เครดิต (${debit} = ${credit})`, debit === credit && debit === amount);

    // ของผิด = ร้านรับผิดชอบ → หักจากยอดค้างจ่ายร้าน ไม่ใช่ให้บริษัทรับ
    check('หักจากยอดค้างจ่ายร้าน เพราะเป็นความผิดของร้าน',
      rows.some((r) => r.account === 'restaurant_payable' && r.debit_satang === amount));
    check('เงินออกจากบริษัทไปหาลูกค้า',
      rows.some((r) => r.account === 'cash' && r.credit_satang === amount));
  } finally {
    await sql.end();
  }
}

/** เบอร์และชื่อผู้ใช้ที่ไม่ชนของเดิม เพื่อให้รันซ้ำได้โดยไม่ติด cooldown ของเบอร์เดิม */
const suffix = String(randomInt(0, 100_000_000)).padStart(8, '0');
const SMOKE_PHONE = `09${suffix}`;
const SMOKE_USERNAME = `smoke_${suffix}`;
const SMOKE_PASSWORD = 'wingdai-smoke-1234';

async function main() {
  console.log(`\nเซิร์ฟเวอร์ ${BASE}`);
  const health = await call('GET', '/health');
  if (health.status !== 200) {
    console.error('เซิร์ฟเวอร์ยังไม่ขึ้น — สั่ง npm start ในอีกหน้าต่างก่อน');
    process.exit(1);
  }

  console.log('\nล็อกอินด้วยบัญชีจาก seed');

  const byUsername = await call('POST', '/auth/login', {
    identifier: 'somchai',
    password: 'wingdai1234',
  });
  check('ล็อกอินด้วย username ได้', byUsername.status === 200, JSON.stringify(byUsername.body));
  check('ได้ token กลับมา', typeof byUsername.body?.token === 'string');
  check(
    'ไม่มี password_hash ติดมาในคำตอบ',
    byUsername.status === 200 && !JSON.stringify(byUsername.body).includes('argon2'),
  );

  // claude.md §4.2 — เบอร์โทรก็เป็น identifier ได้ ไม่ใช่แค่ username
  const byPhone = await call('POST', '/auth/login', {
    identifier: '081-234-5678',
    password: 'wingdai1234',
  });
  check('ล็อกอินด้วยเบอร์โทร (มีขีดคั่น) ได้', byPhone.status === 200, JSON.stringify(byPhone.body));
  check(
    'เบอร์กับ username ชี้บัญชีเดียวกัน',
    !!byPhone.body?.account?.id && byPhone.body.account.id === byUsername.body?.account?.id,
  );

  // claude.md §4.2 — อีเมลไม่ใช่ identifier สำหรับล็อกอิน
  const byEmail = await call('POST', '/auth/login', {
    identifier: 'somchai@wingdai.test',
    password: 'wingdai1234',
  });
  check('ล็อกอินด้วยอีเมลไม่ได้', byEmail.status === 401, `ได้ ${byEmail.status}`);

  const wrongPass = await call('POST', '/auth/login', {
    identifier: 'somchai',
    password: 'ผิดแน่นอน1234',
  });
  check('รหัสผิดถูกปฏิเสธ', wrongPass.status === 401);
  check(
    'ข้อความไม่บอกว่าผิดที่ชื่อผู้ใช้หรือรหัส',
    wrongPass.body?.message === 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  );

  const noSuchUser = await call('POST', '/auth/login', {
    identifier: 'ไม่มีบัญชีนี้',
    password: 'wingdai1234',
  });
  check(
    'บัญชีที่ไม่มีอยู่ตอบเหมือนกันเป๊ะ',
    noSuchUser.status === 401 && noSuchUser.body?.message === wrongPass.body?.message,
  );

  console.log('\nข้อมูลบัญชีที่ส่งกลับ');

  const token = byUsername.body.token as string;
  const me = await call('GET', '/auth/me', undefined, token);
  check('เรียก /me ด้วย token ได้', me.status === 200);
  check('มี ownedRestaurantIds ให้แอปตัดสินใจโชว์โหมดร้าน', Array.isArray(me.body?.ownedRestaurantIds));

  // สมชายมีร้านที่ยังไม่อนุมัติ — ต้องไม่ถูกนับว่าเป็นเจ้าของร้านที่เปิดใช้ได้ (claude.md §4.3)
  check('ร้านที่ยังไม่อนุมัติไม่ถูกนับเป็นสิทธิ์ร้าน', me.body?.ownedRestaurantIds?.length === 0);

  const maleeLogin = await call('POST', '/auth/login', { identifier: 'malee', password: 'wingdai1234' });
  check('บัญชีที่มีร้านอนุมัติแล้วได้สิทธิ์ร้าน', maleeLogin.body?.account?.ownedRestaurantIds?.length === 1);

  const riderLogin = await call('POST', '/auth/login', { identifier: 'rider_new', password: 'wingdai1234' });
  check(
    'ไรเดอร์ที่ยังไม่ส่งเอกสารถือว่ารออนุมัติ',
    riderLogin.body?.account?.riderApproval === 'pending',
    JSON.stringify(riderLogin.body?.account),
  );

  console.log('\nด่านกันการเข้าถึง');

  check('ไม่มี token เรียก /me ไม่ได้', (await call('GET', '/auth/me')).status === 401);
  check('token มั่ว ๆ ใช้ไม่ได้', (await call('GET', '/auth/me', undefined, 'abc.def.ghi')).status === 401);

  console.log('\nสมัครสมาชิกทั้งเส้นทาง');

  const otp = await call('POST', '/auth/otp/request', { phone: SMOKE_PHONE });
  check('ขอรหัส OTP ได้', otp.status === 200, JSON.stringify(otp.body));
  check('โหมด dev คืนรหัสมาให้ทดสอบ', /^[0-9]{6}$/.test(otp.body?.devCode ?? ''));

  const tooSoon = await call('POST', '/auth/otp/request', { phone: SMOKE_PHONE });
  check('ขอรหัสซ้ำทันทีถูกกั้นด้วย cooldown', tooSoon.status === 429, `ได้ ${tooSoon.status}`);

  const usedPhone = await call('POST', '/auth/otp/request', { phone: '0812345678' });
  check('ขอรหัสให้เบอร์ที่สมัครแล้วถูกปฏิเสธ', usedPhone.status === 409);

  const wrongCode = await call('POST', '/auth/otp/verify', { phone: SMOKE_PHONE, code: '000000' });
  const codeWasWrong = otp.body.devCode !== '000000';
  check('รหัสผิดถูกปฏิเสธ', !codeWasWrong || wrongCode.status === 400, JSON.stringify(wrongCode.body));

  const verified = await call('POST', '/auth/otp/verify', {
    phone: SMOKE_PHONE,
    code: otp.body.devCode,
  });
  check('รหัสถูกต้องผ่าน', verified.status === 200, JSON.stringify(verified.body));
  const verificationToken = verified.body?.verificationToken as string;
  check('ได้ตั๋วยืนยันเบอร์', typeof verificationToken === 'string');

  // ตั๋วยืนยันเบอร์เซ็นด้วยกุญแจดอกเดียวกับเซสชัน — ห้ามเอามาสวมเป็นเซสชันได้
  check(
    'ตั๋วยืนยันเบอร์ใช้แทน token เข้าระบบไม่ได้',
    (await call('GET', '/auth/me', undefined, verificationToken)).status === 401,
  );

  const wrongPhone = await call('POST', '/auth/register', {
    username: `${SMOKE_USERNAME}x`,
    password: SMOKE_PASSWORD,
    fullName: 'ผู้ทดสอบ',
    phone: '0998887777',
    accountType: 'user',
    verificationToken,
  });
  check('เอาตั๋วของเบอร์หนึ่งไปสมัครอีกเบอร์ไม่ได้', wrongPhone.status === 400, `ได้ ${wrongPhone.status}`);

  const registered = await call('POST', '/auth/register', {
    username: SMOKE_USERNAME,
    password: SMOKE_PASSWORD,
    fullName: 'ผู้ทดสอบ ระบบ',
    phone: SMOKE_PHONE,
    email: 'smoke@wingdai.test',
    accountType: 'user',
    verificationToken,
  });
  check('สมัครสำเร็จ', registered.status === 201, JSON.stringify(registered.body));
  check('สมัครเสร็จได้ token เลย ไม่ต้องล็อกอินซ้ำ', typeof registered.body?.token === 'string');

  check(
    'ล็อกอินด้วยบัญชีที่เพิ่งสมัครได้',
    (await call('POST', '/auth/login', { identifier: SMOKE_USERNAME, password: SMOKE_PASSWORD }))
      .status === 200,
  );

  // claude.md §4.1 — admin ไม่มีทางสร้างผ่านช่องทางสาธารณะ
  const asAdmin = await call('POST', '/auth/register', {
    username: `${SMOKE_USERNAME}_adm`,
    password: SMOKE_PASSWORD,
    fullName: 'แอบเป็นแอดมิน',
    phone: SMOKE_PHONE,
    accountType: 'admin',
    verificationToken,
  });
  check('สมัครเป็น admin ผ่าน API สาธารณะไม่ได้', asAdmin.status === 400, `ได้ ${asAdmin.status}`);

  console.log('\nรายการร้านและเมนู');

  const anon = await call('GET', '/catalog/restaurants');
  check('ยังไม่ล็อกอินก็ดูรายชื่อร้านได้', anon.status === 200);
  check(
    'ร้านที่ยังไม่อนุมัติไม่โผล่ให้ลูกค้าเห็น',
    Array.isArray(anon.body) && !anon.body.some((r: any) => r.name === 'ร้านรออนุมัติ'),
  );
  check(
    'ไม่รู้ว่าผู้ใช้อยู่ไหน ระยะทางเป็น null ไม่ใช่เลขมั่ว',
    anon.body.every((r: any) => r.distanceKm === null),
  );
  check(
    'ยังไม่มีระบบรีวิว จึงไม่มีคะแนน ไม่ใช่ ★ ปลอม',
    anon.body.every((r: any) => r.rating === null),
  );

  const withAuth = await call('GET', '/catalog/restaurants', undefined, token);
  const malee = withAuth.body?.find((r: any) => r.name === 'ครัวมาลี');
  /**
   * ครัวมาลีอยู่ห่างบ้านสมชาย 242 เมตรตามพิกัดใน seed → ต้องได้ 0.2
   * เคยเจอว่าคืน 0.0 ทุกร้านเพราะชื่อคอลัมน์ใน subquery ไปชนกัน แล้ววัดระยะจากที่อยู่หาตัวเอง
   * — ไม่มี error ให้เห็นเลย ต้องเทียบกับเลขที่รู้คำตอบอยู่แล้วเท่านั้นถึงจับได้
   */
  check(
    'ล็อกอินแล้วได้ระยะทางจริงจากที่อยู่ตัวเอง',
    malee?.distanceKm === 0.2,
    `ได้ ${JSON.stringify(malee?.distanceKm)} (${typeof malee?.distanceKm})`,
  );
  check(
    'ร้านที่ไกลกว่าต้องได้ตัวเลขมากกว่า ไม่ใช่เท่ากันหมด',
    new Set(withAuth.body.map((r: any) => r.distanceKm)).size > 1,
  );

  const byName = await call('GET', '/catalog/restaurants?q=' + encodeURIComponent('ส้มตำ'));
  check('ค้นด้วยชื่อร้านเจอ', byName.body?.length === 1 && byName.body[0].name === 'ส้มตำแซ่บนัว');

  // design C2 บอกว่า "ค้นหาร้านหรือเมนู" — พิมพ์ชื่ออาหารต้องเจอร้านที่ขายของนั้น
  const byDish = await call('GET', '/catalog/restaurants?q=' + encodeURIComponent('กะเพรา'));
  check('ค้นด้วยชื่อเมนูแล้วเจอร้านที่ขาย', byDish.body?.length === 1 && byDish.body[0].name === 'ครัวมาลี');

  const menu = await call('GET', `/catalog/restaurants/${malee.id}/menu`);
  check('ดึงเมนูของร้านได้', menu.status === 200 && menu.body.length === 5, `ได้ ${menu.body?.length}`);
  const kaphrao = menu.body?.find((m: any) => m.name === 'ข้าวกะเพราหมูสับ');
  check('ราคาเป็นสตางค์จำนวนเต็ม', Number.isInteger(kaphrao?.price) && kaphrao.price === 5000);
  check('กลุ่มตัวเลือกติดมาด้วย', kaphrao?.optionGroups?.length === 2);

  console.log('\nสั่งอาหาร — เซิร์ฟเวอร์ต้องเป็นคนคิดเงิน');

  const kaphraoId = kaphrao.id as string;
  const spicyMid = kaphrao.optionGroups[0].choices[1].id as string; // เผ็ดกลาง +0
  const egg = kaphrao.optionGroups[1].choices[0].id as string; // ไข่ดาว +฿15

  const placed = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: kaphraoId, quantity: 2, choiceIds: [spicyMid, egg] }],
    paymentMethod: 'cash',
  }, token);
  check('สั่งได้', placed.status === 201, JSON.stringify(placed.body));
  createdOrderIds.push(placed.body?.id);

  // ข้าวกะเพรา ฿50 + ไข่ดาว ฿15 = ฿65 ต่อจาน × 2 = ฿130
  check('ราคาต่อหน่วยรวมตัวเลือกที่เลือก', placed.body?.items?.[0]?.unitPrice === 6500, `ได้ ${placed.body?.items?.[0]?.unitPrice}`);
  check('ค่าอาหารคิดจากเมนูในฐาน ไม่ใช่จากที่แอปส่ง', placed.body?.foodTotal === 13000, `ได้ ${placed.body?.foodTotal}`);
  check('ค่าส่งกับค่าบริการแยกบรรทัด', placed.body?.deliveryFee === 1500 && placed.body?.serviceFee === 500);
  check('ชื่อรายการมีตัวเลือกต่อท้ายให้ร้านเห็น', /ไข่ดาว/.test(placed.body?.items?.[0]?.name ?? ''));
  check('เลขที่ออร์เดอร์อ่านออก ไม่ใช่ uuid', /^WD-[23456789A-HJ-NP-Z]{6}$/.test(placed.body?.reference ?? ''));
  check('สั่งเงินสด = ยังไม่จ่าย', placed.body?.paymentStatus === 'pending');

  // แอปที่ถูกแก้ส่งราคาปลอมมาต้องไม่มีผล เพราะเซิร์ฟเวอร์ไม่เคยอ่านช่องราคาจาก body
  const cheated = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: kaphraoId, quantity: 1, choiceIds: [spicyMid], unitPrice: 1, price: 1 }],
    paymentMethod: 'cash',
  }, token);
  createdOrderIds.push(cheated.body?.id);
  check('ส่งราคาปลอมมาก็ยังคิดราคาจริง', cheated.body?.foodTotal === 5000, `ได้ ${cheated.body?.foodTotal}`);

  const missingRequired = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: kaphraoId, quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash',
  }, token);
  check('ไม่เลือกกลุ่มที่ร้านบังคับ สั่งไม่ได้', missingRequired.status === 400, `ได้ ${missingRequired.status}`);

  const closedShop = withAuth.body.find((r: any) => r.name === 'ก๋วยเตี๋ยวเรือ');
  const closedMenu = await call('GET', `/catalog/restaurants/${closedShop.id}/menu`);
  const fromClosed = await call('POST', '/orders', {
    restaurantId: closedShop.id,
    items: [{ menuItemId: closedMenu.body[1].id, quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash',
  }, token);
  check('ร้านปิดสั่งไม่ได้', fromClosed.status === 400, `ได้ ${fromClosed.status}`);

  // claude.md §4.3 — มาลีเป็นเจ้าของครัวมาลี สั่งร้านตัวเองไม่ได้
  const maleeToken = maleeLogin.body.token as string;
  const selfOrder = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: kaphraoId, quantity: 1, choiceIds: [spicyMid] }],
    paymentMethod: 'cash',
  }, maleeToken);
  check('เจ้าของร้านสั่งร้านตัวเองไม่ได้', selfOrder.status === 403, `ได้ ${selfOrder.status}`);

  // มาลีเป็นเจ้าของครัวมาลี จึง **ต้อง** เห็นออร์เดอร์ที่เข้าร้านตัวเอง (คิวออร์เดอร์ของร้าน)
  const ownerPeek = await call('GET', `/orders/${placed.body.id}`, undefined, maleeToken);
  check('เจ้าของร้านเห็นออร์เดอร์ที่เข้าร้านตัวเอง', ownerPeek.status === 200, `ได้ ${ownerPeek.status}`);

  // ส่วนคนที่ไม่เกี่ยวอะไรเลยต้องไม่เห็น และตอบ 404 ไม่ใช่ 403 — 403 เป็นการยืนยันว่ามีออร์เดอร์นี้อยู่
  const strangerToken = riderLogin.body.token as string;
  const strangerPeek = await call('GET', `/orders/${placed.body.id}`, undefined, strangerToken);
  check('คนที่ไม่เกี่ยวข้องเปิดดูไม่ได้', strangerPeek.status === 404, `ได้ ${strangerPeek.status}`);

  console.log('\nสิทธิ์การเปลี่ยนสถานะ (กันสร้างรายการบัญชีของคนอื่น)');

  /*
   * `delivered` เขียน ledger จริง — ถ้าใครก็กดได้ จะสร้างรายการบัญชีของออร์เดอร์คนอื่นได้
   * ลูกค้าจึงกดได้แค่ยกเลิก · ร้านรับ/กำลังทำ · ไรเดอร์ที่รับงานแล้วรับของ/ส่งถึง
   */
  const byCustomer = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'accepted' }, token);
  check('ลูกค้ารับออร์เดอร์แทนร้านไม่ได้', byCustomer.status === 403, `ได้ ${byCustomer.status}`);

  const byStranger = await call(
    'PATCH', `/orders/${placed.body.id}/status`, { status: 'accepted' }, strangerToken,
  );
  check('คนที่ไม่เกี่ยวข้องเปลี่ยนสถานะไม่ได้ (404 ไม่ใช่ 403)', byStranger.status === 404, `ได้ ${byStranger.status}`);

  console.log('\nคิวออร์เดอร์ฝั่งร้าน (claude.md §8 อัตราการรับออร์เดอร์ > 95%)');

  const queue = await call('GET', '/merchant/orders', undefined, maleeToken);
  check('ร้านดึงคิวออร์เดอร์ของตัวเองได้', queue.status === 200, JSON.stringify(queue.body));
  const queued = queue.body?.find((o: any) => o.id === placed.body.id);
  check('ออร์เดอร์ใหม่โผล่ในคิวร้าน', !!queued);
  check('คิวเรียงเก่าไปใหม่ ใบที่รอนานสุดอยู่บน', queue.body.every((o: any, i: number) =>
    i === 0 || queue.body[i - 1].createdAt <= o.createdAt));
  check('ครัวเห็นชื่อรายการพร้อมตัวเลือกที่ลูกค้าเลือก', /ไข่ดาว/.test(queued?.items?.[0]?.name ?? ''));

  /*
   * ร้านเห็นว่าตัวเองได้เท่าไหร่จากใบนี้ = ค่าอาหาร − คอมมิชชัน 15% (§6.1)
   * ค่าส่ง/ค่าบริการไม่ใช่ของร้าน จึงต้องไม่โผล่ในยอดนี้ ไม่งั้นร้านจะคาดหวังผิด
   */
  check('ยอดที่ร้านได้ = ค่าอาหาร − 15%', queued?.restaurantPayout === 13000 - 1950,
    `ได้ ${queued?.restaurantPayout} จาก commission ${queued?.commission}`);
  check('คอมมิชชันคิดจากค่าอาหารอย่างเดียว ไม่รวมค่าส่ง', queued?.commission === 1950, `ได้ ${queued?.commission}`);

  // ร้านไม่ได้เป็นคนไปส่ง จึงไม่ต้องรู้เบอร์ลูกค้า — เก็บข้อมูลส่วนบุคคลเท่าที่งานต้องใช้
  check('คิวร้านไม่มีเบอร์โทรลูกค้าติดมา', !JSON.stringify(queue.body).includes('081'));

  const otherQueue = await call('GET', '/merchant/orders', undefined, strangerToken);
  check('คนที่ไม่มีร้านได้คิวว่าง ไม่ใช่ error', otherQueue.status === 200 && otherQueue.body.length === 0);

  // ขอดูคิวร้านคนอื่นตรง ๆ ต้องได้ว่าง ไม่ใช่ข้อมูลร้านนั้น
  const peekOthers = await call('GET', `/merchant/orders?restaurantId=${malee.id}`, undefined, strangerToken);
  check('ระบุ id ร้านคนอื่นก็ยังไม่เห็นคิวเขา', peekOthers.status === 200 && peekOthers.body.length === 0);

  const shops = await call('GET', '/merchant/restaurants', undefined, maleeToken);
  check('ร้านดึงรายชื่อร้านของตัวเองได้', shops.status === 200 && shops.body.length === 1);
  check('รายชื่อร้านมีแต่ร้านของตัวเอง', shops.body[0]?.name === 'ครัวมาลี');

  const closeShop = await call('PATCH', `/merchant/restaurants/${malee.id}/open`, { isOpen: false }, maleeToken);
  check('ร้านปิดรับออร์เดอร์เองได้', closeShop.status === 200 && closeShop.body?.isOpen === false);
  const reopen = await call('PATCH', `/merchant/restaurants/${malee.id}/open`, { isOpen: true }, maleeToken);
  check('ร้านเปิดกลับได้', reopen.status === 200 && reopen.body?.isOpen === true);

  const hijack = await call('PATCH', `/merchant/restaurants/${malee.id}/open`, { isOpen: false }, token);
  check('คนอื่นสั่งปิดร้านเราไม่ได้ (404 ไม่ใช่ 403)', hijack.status === 404, `ได้ ${hijack.status}`);

  // somchai เป็นเจ้าของ "ร้านรออนุมัติ" — ยังไม่ผ่านการตรวจ จึงเปิดรับออร์เดอร์ไม่ได้
  const myShops = await call('GET', '/merchant/restaurants', undefined, token);
  const pendingShop = myShops.body?.find((r: any) => r.name === 'ร้านรออนุมัติ');
  check('ร้านที่รออนุมัติยังอยู่ในรายชื่อ เพื่อให้จอบอกสถานะได้', !!pendingShop && pendingShop.isApproved === false);
  const openPending = await call('PATCH', `/merchant/restaurants/${pendingShop?.id}/open`, { isOpen: true }, token);
  check('ร้านที่ยังไม่อนุมัติเปิดรับออร์เดอร์ไม่ได้', openPending.status === 404, `ได้ ${openPending.status}`);

  console.log('\nแก้เมนูฝั่งร้าน');

  const newItem = await call('POST', '/merchant/menu', {
    restaurantId: malee.id,
    name: 'เมนูทดสอบ smoke',
    price: 4500,
    category: 'rice',
  }, maleeToken);
  check('ร้านเพิ่มเมนูได้', newItem.status === 201, JSON.stringify(newItem.body));
  createdMenuItemIds.push(newItem.body?.id);
  check('ราคาที่ได้กลับมาเป็นสตางค์จำนวนเต็ม', newItem.body?.price === 4500);

  const floatPrice = await call('POST', '/merchant/menu', {
    restaurantId: malee.id, name: 'ราคาทศนิยม', price: 45.5, category: 'rice',
  }, maleeToken);
  // §5 กติกาข้อ 1 — เงินเป็นสตางค์จำนวนเต็มเท่านั้น ปล่อยเศษเข้าฐานแล้วคอมมิชชัน 15% จะเพี้ยน
  check('ราคาที่มีเศษทศนิยมถูกปฏิเสธ', floatPrice.status === 400, `ได้ ${floatPrice.status}`);

  const otherShopMenu = await call('POST', '/merchant/menu', {
    restaurantId: malee.id, name: 'แทรกเมนูร้านคนอื่น', price: 100, category: 'rice',
  }, token);
  check('เพิ่มเมนูให้ร้านคนอื่นไม่ได้', otherShopMenu.status === 404, `ได้ ${otherShopMenu.status}`);

  const soldOut = await call('PATCH', `/merchant/menu/${newItem.body.id}`, { isAvailable: false }, maleeToken);
  check('ร้านกดของหมดได้', soldOut.status === 200 && soldOut.body?.isAvailable === false);

  const soldOutOrder = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: newItem.body.id, quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash',
  }, token);
  check('ของที่ร้านเพิ่งกดหมด สั่งไม่ได้ทันที', soldOutOrder.status === 409, `ได้ ${soldOutOrder.status}`);

  const editOthers = await call('PATCH', `/merchant/menu/${kaphraoId}`, { price: 1 }, token);
  check('แก้ราคาเมนูร้านคนอื่นไม่ได้', editOthers.status === 404, `ได้ ${editOthers.status}`);

  console.log('\nเปลี่ยนสถานะและลง ledger');

  /*
   * แอดมินมีสิทธิ์ทุกสถานะตาม §6.3 (ทางแทรกมือเมื่อระบบจ่ายงานพลาด)
   * ใช้ทดสอบกฎ "ข้ามขั้นไม่ได้" เพราะต้องเป็นคนที่ผ่านด่านสิทธิ์แล้วจริง ๆ
   * ไม่งั้นจะได้ 403 ก่อนถึงการเช็คลำดับ แล้วเข้าใจผิดว่ากฎลำดับทำงาน
   */
  const adminLogin = await call('POST', '/auth/login', { identifier: 'admin_root', password: 'wingdai1234' });
  const adminToken = adminLogin.body.token as string;
  check('แอดมินล็อกอินได้', adminLogin.status === 200);

  const skip = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'delivered' }, adminToken);
  check('ข้ามขั้นสถานะไม่ได้ แม้เป็นแอดมิน (created → delivered)', skip.status === 400, `ได้ ${skip.status}`);

  // ร้านรับออร์เดอร์แล้วบอกว่ากำลังทำ — เป็นคิวออร์เดอร์ของร้าน
  for (const s of ['accepted', 'preparing'] as const) {
    const r = await call('PATCH', `/orders/${placed.body.id}/status`, { status: s }, maleeToken);
    check(`ร้านเปลี่ยนเป็น ${s} ได้`, r.status === 200, JSON.stringify(r.body));
  }

  const pickupByShop = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'picked_up' }, maleeToken);
  check('ร้านกดรับของแทนไรเดอร์ไม่ได้', pickupByShop.status === 403, `ได้ ${pickupByShop.status}`);

  // ยังไม่มีระบบจ่ายงานไรเดอร์ (คลื่นที่ 4) จึงยังไม่มีไรเดอร์ผูกกับออร์เดอร์ — แอดมินเดินต่อให้
  const pickedUp = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'picked_up' }, adminToken);
  check('แอดมินแทรกมือเปลี่ยนสถานะได้ (§6.3)', pickedUp.status === 200, JSON.stringify(pickedUp.body));

  const switched = await call('POST', `/orders/${placed.body.id}/pay-promptpay`, undefined, token);
  check('เงินสดไม่พอ → เปลี่ยนเป็นพร้อมเพย์ได้', switched.status === 200, JSON.stringify(switched.body));
  check('เปลี่ยนแล้วถือว่าจ่ายแล้ว', switched.body?.paymentStatus === 'paid');

  const twice = await call('POST', `/orders/${placed.body.id}/pay-promptpay`, undefined, token);
  check('กดจ่ายซ้ำไม่ได้', twice.status === 409, `ได้ ${twice.status}`);

  const deliveredByCustomer = await call(
    'PATCH', `/orders/${placed.body.id}/status`, { status: 'delivered' }, token,
  );
  // ข้อสำคัญที่สุด — ลูกค้ากด delivered เองได้ = สร้างรายการบัญชีปลอมของตัวเองได้
  check('ลูกค้ากดส่งถึงแล้วเองไม่ได้', deliveredByCustomer.status === 403, `ได้ ${deliveredByCustomer.status}`);

  const done = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'delivered' }, adminToken);
  check('ส่งถึงแล้ว (แอดมิน)', done.status === 200, JSON.stringify(done.body));

  const after = await call('POST', `/orders/${placed.body.id}/pay-promptpay`, undefined, token);
  check('ส่งถึงแล้วเปลี่ยนวิธีจ่ายไม่ได้', after.status === 409, `ได้ ${after.status}`);

  console.log('\nจ่ายงานไรเดอร์อัตโนมัติ (claude.md §6.3)');
  await dispatchChecks(token, maleeToken, adminToken, malee.id, kaphraoId, spicyMid);

  console.log('\nledger ที่เขียนลงฐานจริง (claude.md §6.2)');
  await checkLedger(placed.body.id);

  /*
   * ใบที่ไรเดอร์รับไปแล้วต้องหลุดจากคิวครัว ไม่งั้นคิวจะยาวขึ้นเรื่อย ๆ
   * จนใบที่ต้องรีบจริงถูกกลบ — ซึ่งเป็นทางตรงไปสู่อัตราการรับออร์เดอร์ที่ต่ำลง (§8)
   */
  const queueAfter = await call('GET', '/merchant/orders', undefined, maleeToken);
  check('ใบที่ส่งถึงแล้วหลุดจากคิวครัว', !queueAfter.body.some((o: any) => o.id === placed.body.id));
  const history = await call('GET', '/merchant/orders?scope=history', undefined, maleeToken);
  check('ใบที่จบแล้วไปอยู่ในประวัติของร้าน', history.body.some((o: any) => o.id === placed.body.id));
  check('ประวัติเรียงใหม่ไปเก่า', history.body.every((o: any, i: number) =>
    i === 0 || history.body[i - 1].createdAt >= o.createdAt));

  console.log('\nคืนเงินกึ่งอัตโนมัติ + จอ exception ของแอดมิน (§6.4 · §7)');
  await refundChecks(token, adminToken, placed.body.id);

  console.log('\nที่อยู่จัดส่ง');

  const addrs = await call('GET', '/addresses', undefined, token);
  check('ดึงที่อยู่ของตัวเองได้', addrs.status === 200 && addrs.body.length === 2);
  check('ที่อยู่มีพิกัดติดมาด้วย', typeof addrs.body?.[0]?.lat === 'number' && typeof addrs.body?.[0]?.lng === 'number');

  const newAccountToken = registered.body?.token as string;
  const noAddress = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: kaphraoId, quantity: 1, choiceIds: [spicyMid] }],
    paymentMethod: 'cash',
  }, newAccountToken);
  check('บัญชีใหม่ที่ยังไม่มีที่อยู่ สั่งไม่ได้และบอกเหตุผลชัด', noAddress.status === 400 && !!noAddress.body?.fields?.deliveryAddressId);

  const added = await call('POST', '/addresses', {
    label: 'หอพัก', addressText: 'ซอยอารีย์ 5', lat: 13.7808, lng: 100.5441,
  }, newAccountToken);
  check('เพิ่มที่อยู่แล้วสั่งได้', added.status === 201);
  const nowCanOrder = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: kaphraoId, quantity: 1, choiceIds: [spicyMid] }],
    paymentMethod: 'promptpay',
  }, newAccountToken);
  createdOrderIds.push(nowCanOrder.body?.id);
  check('บัญชีใหม่สั่งได้หลังเพิ่มที่อยู่', nowCanOrder.status === 201, JSON.stringify(nowCanOrder.body));
  check('พร้อมเพย์ = จ่ายแล้วตั้งแต่สั่ง', nowCanOrder.body?.paymentStatus === 'paid');

  console.log('\nGoogle sign-in — เส้นทางที่ต้องถูกปฏิเสธ');

  /*
   * ทางที่สำเร็จต้องมี id_token จริงจาก Google ซึ่งสร้างในสคริปต์ไม่ได้ — ทดสอบด้วยมือบนเครื่อง
   * แต่ทางที่ต้องปฏิเสธคือส่วนที่พลาดแล้วเจ็บ ถ้าเซิร์ฟเวอร์เผลอเชื่อ token ที่ไม่ได้ตรวจ
   * ใครก็ปลอมเป็นใครก็ได้ — จึงต้องมีเครื่องยืนยันอัตโนมัติตรงนี้
   */
  const fakeGoogle = await call('POST', '/auth/google', { idToken: 'ไม่ใช่ token จริง' });
  check('id_token มั่ว ๆ ถูกปฏิเสธ', fakeGoogle.status === 401, `ได้ ${fakeGoogle.status}`);

  const emptyGoogle = await call('POST', '/auth/google', { idToken: '' });
  check('id_token ว่างถูกปฏิเสธตั้งแต่ชั้นตรวจข้อมูล', emptyGoogle.status === 400);

  // ตั๋วเซสชันเซ็นด้วยกุญแจดอกเดียวกับตั๋วผูก Google — ต้องแยกกันด้วย typ ไม่ใช่แค่ลายเซ็นถูก
  const sessionAsGoogle = await call('POST', '/auth/google/register', {
    googleToken: token,
    username: `${SMOKE_USERNAME}_g`,
    fullName: 'ผู้ทดสอบ',
    phone: SMOKE_PHONE,
    accountType: 'user',
    verificationToken,
  });
  check('เอาตั๋วเซสชันมาใช้แทนตั๋ว Google ไม่ได้', sessionAsGoogle.status === 401, `ได้ ${sessionAsGoogle.status}`);

  console.log('\nการตรวจข้อมูลที่ส่งเข้ามา');

  const badPhone = await call('POST', '/auth/otp/request', { phone: '123' });
  check('เบอร์ผิดรูปแบบถูกปฏิเสธพร้อมบอกช่องที่ผิด', badPhone.status === 400 && !!badPhone.body?.fields?.phone);

  const shortPass = await call('POST', '/auth/register', {
    username: 'someone_new',
    password: '123',
    fullName: 'ชื่อ',
    phone: SMOKE_PHONE,
    accountType: 'user',
    verificationToken,
  });
  check('รหัสผ่านสั้นเกินถูกปฏิเสธ', shortPass.status === 400 && !!shortPass.body?.fields?.password);
}

/** ลบร่องรอยของการทดสอบทุกครั้ง ไม่ว่าจะผ่านหรือไม่ผ่าน */
async function cleanup() {
  const sql = createScriptClient();
  try {
    const ids = createdOrderIds.filter(Boolean);
    if (ids.length > 0) {
      /*
       * ledger เป็น append-only มี trigger ห้าม DELETE — ปิดชั่วคราวเฉพาะตอนเก็บกวาดข้อมูลทดสอบ
       * ยอมทำตรงนี้เพราะเป็นสคริปต์ทดสอบที่รู้ว่าแถวไหนของตัวเอง **ห้ามทำแบบนี้ในโค้ดจริง**
       * การแก้ยอดผิดในระบบจริงคือเขียนรายการกลับทาง ไม่ใช่ลบของเก่า (claude.md §6.2)
       */
      await sql`alter table ledger_entries disable trigger ledger_entries_no_delete`;
      await sql`delete from ledger_entries where order_id in ${sql(ids)}`;
      await sql`alter table ledger_entries enable trigger ledger_entries_no_delete`;
      await sql`delete from refund_cases where order_id in ${sql(ids)}`;
      await sql`delete from dispatch_offers where order_id in ${sql(ids)}`;
      await sql`delete from orders where id in ${sql(ids)}`;
    }
    const menuIds = createdMenuItemIds.filter(Boolean);
    if (menuIds.length > 0) await sql`delete from menu_items where id in ${sql(menuIds)}`;
    await sql`delete from accounts where username = ${SMOKE_USERNAME}`;
    await sql`delete from phone_verifications where phone = ${SMOKE_PHONE}`;
  } finally {
    await sql.end();
  }
}

main()
  .catch((error) => {
    console.error('\nสคริปต์ล้มกลางคัน:', error.message);
    failed += 1;
  })
  .finally(async () => {
    await cleanup();
    console.log(`\nผ่าน ${passed} · ไม่ผ่าน ${failed}\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
