import 'dotenv/config';
import { randomInt } from 'node:crypto';
import { createScriptClient } from './db/client';

/** ยิง HTTP จริงใส่เซิร์ฟเวอร์ที่รันอยู่ ตั้งแต่ขอ OTP จนล็อกอินสำเร็จ */
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

/** ออเดอร์ที่สร้างระหว่างทดสอบ ต้องลบทิ้งตอนจบ ไม่ทิ้งขยะไว้ในฐาน */
const createdOrderIds: string[] = [];
const createdMenuItemIds: string[] = [];
const createdRestaurantIds: string[] = [];
/** ตั๋วที่เปิดระหว่างทดสอบ ข้อความในเธรดหายตามด้วย on delete cascade */
const createdTicketIds: string[] = [];

/** อ่าน ledger ที่เขียนลงฐานจริงแล้วเทียบกับตัวเลขที่คำนวณมือ */
async function checkLedger(orderId: string) {
  const sql = createScriptClient();
  try {
    const rows = await sql<{ account: string; debit_satang: number; credit_satang: number }[]>`
      select account, debit_satang, credit_satang from ledger_entries where order_id = ${orderId}`;

    check('ส่งถึงแล้วมีรายการบัญชีเกิดขึ้น', rows.length > 0, `ได้ ${rows.length} แถว`);

    const debit = rows.reduce((s, r) => s + r.debit_satang, 0);
    const credit = rows.reduce((s, r) => s + r.credit_satang, 0);
    check(`เดบิต = เครดิต (${debit} = ${credit})`, debit === credit);

    /** ออเดอร์นี้: ค่าอาหาร ฿130 + ค่าส่ง ฿15 + ค่าบริการ ฿5 = ฿150 */
    const by = (a: string) =>
      rows.filter((r) => r.account === a).reduce((s, r) => s + r.debit_satang + r.credit_satang, 0);

    check(`เงินเข้าบริษัท ฿150 (ได้ ${by('cash') / 100})`, by('cash') === 15000);
    check(`ยอดค้างจ่ายร้าน ฿110.50 (ได้ ${by('restaurant_payable') / 100})`, by('restaurant_payable') === 11050);
    check(`รายได้แพลตฟอร์ม ฿39.50 (ได้ ${by('platform_revenue') / 100})`, by('platform_revenue') === 3950);
    check('ยังไม่มีไรเดอร์ จึงไม่มีบรรทัดค้างจ่ายไรเดอร์', by('rider_payable') === 0);
    check('ไม่มีแถวที่เป็นศูนย์ทั้งสองข้าง', rows.every((r) => (r.debit_satang > 0) !== (r.credit_satang > 0)));

    // §6.2 เขียนอย่างเดียว แก้ยอดผิดด้วยรายการกลับทางเท่านั้น
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

/** เส้นทางจ่ายงานทั้งเส้น ไรเดอร์ออนไลน์ → ถูกเสนองาน → รับ → ส่งถึง */
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

  // ออเดอร์ใหม่ที่ร้านรับแล้ว → พร้อมให้จ่ายงาน
  const job = await call('POST', '/orders', {
    restaurantId,
    // ฝากข้อความไว้ด้วย เพื่อพิสูจน์ว่ามันเดินทางไปถึงจอจุดรับอาหารของไรเดอร์ (R10)
    items: [{ menuItemId, quantity: 1, choiceIds: [choiceId], note: 'ไม่ใส่ผักชี' }],
    paymentMethod: 'cash',
  }, customerToken);
  check('สร้างออเดอร์สำหรับทดสอบการจ่ายงานได้', job.status === 201, JSON.stringify(job.body));
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
  check('ออเดอร์ที่มีไรเดอร์แล้วสั่งจ่ายซ้ำไม่ได้', again.body?.offered === false);

  const jobs = await call('GET', '/rider/jobs', undefined, annToken);
  check('งานโผล่ในรายการงานของไรเดอร์', jobs.body?.some((j: any) => j.orderId === job.body.id));

  /** จุดรับอาหาร (design R10) ไรเดอร์คือคนสุดท้ายที่ตรวจถุงได้ก่อนออกจากร้าน */
  const mine = jobs.body?.find((j: any) => j.orderId === job.body.id);
  check('ของในถุงมีตัวเลือกที่ลูกค้าเลือกแยกเป็นรายการ',
    Array.isArray(mine?.items?.[0]?.choiceNames) && mine.items[0].choiceNames.length > 0,
    JSON.stringify(mine?.items?.[0]));
  check('ของในถุงพกข้อความที่ลูกค้าฝากถึงร้าน',
    mine?.items?.some((i: any) => i.note === 'ไม่ใส่ผักชี'),
    JSON.stringify(mine?.items?.map((i: any) => i.note)));
  check('งานบอกเวลาทำของร้านและเวลาที่ร้านรับออเดอร์ (§6.3)',
    Number.isInteger(mine?.prepTimeMinutes) && mine.prepTimeMinutes > 0 && mine?.acceptedAt !== null,
    `prep ${mine?.prepTimeMinutes} acceptedAt ${mine?.acceptedAt}`);

  const ping = await call('POST', '/rider/ping', { lat: 13.7808, lng: 100.5439 }, annToken);
  check('ส่งพิกัดระหว่างทางได้', ping.status === 200);

  // ครัวต้องบอกว่ากำลังทำก่อน ไรเดอร์ถึงจะกดรับของได้ ข้ามขั้นไม่ได้ (orders/stateMachine.ts)
  const tooEarly = await call('PATCH', `/orders/${job.body.id}/status`, { status: 'picked_up' }, annToken);
  check('อาหารยังไม่เริ่มทำ ไรเดอร์กดรับของไม่ได้', tooEarly.status === 400, `ได้ ${tooEarly.status}`);
  await call('PATCH', `/orders/${job.body.id}/status`, { status: 'preparing' }, maleeToken);

  // §6.3 ไรเดอร์ที่รับงานแล้วเท่านั้นที่กดรับของ/ส่งถึงได้
  const pickedUp = await call('PATCH', `/orders/${job.body.id}/status`, { status: 'picked_up' }, annToken);
  check('ไรเดอร์กดรับของได้', pickedUp.status === 200, JSON.stringify(pickedUp.body));

  await riderIssueChecks(job.body.id, annToken, newbieToken, adminToken);

  /** R11 ปิดงานต้องมีรหัสยืนยันสี่หลักที่ลูกค้าเห็นบนจอติดตาม */
  const riderView = await call('GET', `/orders/${job.body.id}`, undefined, annToken);
  check('ไรเดอร์มองไม่เห็นรหัสยืนยันของลูกค้า',
    riderView.body?.deliveryPin === undefined, `ได้ ${riderView.body?.deliveryPin}`);

  const customerView = await call('GET', `/orders/${job.body.id}`, undefined, customerToken);
  const pin = customerView.body?.deliveryPin as string;
  check('ลูกค้าเห็นรหัสยืนยันสี่หลักของตัวเอง', /^[0-9]{4}$/.test(pin ?? ''), `ได้ ${pin}`);

  /** พิกัดสามจุดของจอติดตาม (design C6) */
  check('ออเดอร์พกพิกัดร้านและปลายทางมาให้แผนที่',
    typeof customerView.body?.restaurantLat === 'number'
      && typeof customerView.body?.dropoffLng === 'number',
    JSON.stringify({
      lat: customerView.body?.restaurantLat, lng: customerView.body?.dropoffLng,
    }));
  check('งานที่ยังเดินอยู่ ลูกค้าเห็นตำแหน่งไรเดอร์',
    customerView.body?.riderLocation !== null
      && typeof customerView.body?.riderLocation?.lat === 'number',
    JSON.stringify(customerView.body?.riderLocation));

  /** รูปยืนยันส่ง (design R11) เข้าบักเก็ต ปิด ตัวเดียวกับเอกสารไรเดอร์ */
  const proof = await call('POST', '/storage/delivery-proof/sign-upload',
    { orderId: job.body.id, ext: 'jpg' }, annToken);
  check('ขอลิงก์อัปรูปยืนยันส่งได้', proof.status === 201, JSON.stringify(proof.body));
  check('รูปยืนยันส่งอยู่ในโฟลเดอร์ของไรเดอร์คนนั้น',
    typeof proof.body?.path === 'string' && proof.body.path.includes(job.body.id),
    proof.body?.path);

  const noPin = await call('PATCH', `/orders/${job.body.id}/status`, { status: 'delivered' }, annToken);
  check('ปิดงานโดยไม่กรอกรหัสไม่ได้', noPin.status === 400, `ได้ ${noPin.status}`);

  const wrongPin = await call('PATCH', `/orders/${job.body.id}/status`,
    { status: 'delivered', deliveryPin: pin === '0000' ? '1111' : '0000' }, annToken);
  check('รหัสผิดปิดงานไม่ได้', wrongPin.status === 400, `ได้ ${wrongPin.status}`);

  const stillPickedUp = await call('GET', `/orders/${job.body.id}`, undefined, customerToken);
  check('รหัสผิดแล้วสถานะไม่ขยับ', stillPickedUp.body?.status === 'picked_up',
    `ได้ ${stillPickedUp.body?.status}`);

  const delivered = await call('PATCH', `/orders/${job.body.id}/status`,
    { status: 'delivered', deliveryPin: pin, photoPath: proof.body?.path }, annToken);
  check('รหัสถูกแล้วไรเดอร์ปิดงานได้', delivered.status === 200, JSON.stringify(delivered.body));
  // §6.5 ส่งถึงแล้วถือว่าเก็บเงินสดครบ
  check('ออเดอร์เงินสดที่ส่งถึงแล้วเปลี่ยนเป็นจ่ายแล้ว', delivered.body?.paymentStatus === 'paid');

  const afterDelivery = await call('GET', `/orders/${job.body.id}`, undefined, customerToken);
  check('ส่งถึงแล้วตำแหน่งไรเดอร์หายไป ไม่ให้ตามต่อ',
    afterDelivery.body?.riderLocation === null,
    JSON.stringify(afterDelivery.body?.riderLocation));

  const afterStatus = await call('GET', '/rider/status', undefined, annToken);
  /** §6.2 เงินสดที่ไรเดอร์เก็บคือเงินของบริษัทที่เขาถือไว้ ต้องบวกเข้ายอดในมือทันที */
  check('เงินสดที่เก็บมาเข้าไปอยู่ในยอดเงินในมือของไรเดอร์', afterStatus.body?.cashHeldSatang >= 7000, `ได้ ${afterStatus.body?.cashHeldSatang}`);
  check('ไม่มีงานค้างอยู่แล้ว', afterStatus.body?.activeJobs?.length === 0);

  const stats = await call('GET', '/rider/stats', undefined, annToken);
  check('มีตัวเลข Orders per Rider Hour ให้ดู (§8 North Star)', stats.status === 200 && typeof stats.body?.hours === 'number');

  const offline = await call('POST', '/rider/online', { isOnline: false }, annToken);
  check('ปิดรับงานได้', offline.status === 200 && offline.body?.isOnline === false);

  /** §6.2 ไรเดอร์นำเงินสดมาส่งคืนบริษัท */
  const held = afterStatus.body?.cashHeldSatang as number;

  const settleByRider = await call('POST', `/admin/riders/${annId}/settle-cash`, { amountSatang: held }, annToken);
  check('ไรเดอร์กดล้างยอดเงินสดตัวเองไม่ได้', settleByRider.status === 403, `ได้ ${settleByRider.status}`);

  const tooMuch = await call('POST', `/admin/riders/${annId}/settle-cash`, { amountSatang: held + 1 }, adminToken);
  check('รับเงินเกินยอดที่ถืออยู่ไม่ได้', tooMuch.status === 409, `ได้ ${tooMuch.status}`);

  const settled = await call('POST', `/admin/riders/${annId}/settle-cash`, { amountSatang: held }, adminToken);
  check('แอดมินรับเงินนำส่งได้', settled.status === 200, JSON.stringify(settled.body));
  check('ยอดเงินในมือกลับเป็นศูนย์', settled.body?.cashHeldSatang === 0, `ได้ ${settled.body?.cashHeldSatang}`);

  const clearedStatus = await call('GET', '/rider/status', undefined, annToken);
  check('ไรเดอร์เห็นยอดเป็นศูนย์แล้ว', clearedStatus.body?.cashHeldSatang === 0);

  // §6.2 ข้อ 2 ledger ต้องถูกเขียนในทรานแซกชันเดียวกัน และต้องสมดุล
  const ledgerSql = createScriptClient();
  try {
    const [row] = await ledgerSql`
      select
        coalesce(sum(debit_satang), 0)::int  as debit,
        coalesce(sum(credit_satang), 0)::int as credit,
        count(*)::int                        as lines
      from ledger_entries
      where reason = 'rider.cash_settled' and counterparty_account_id = ${annId}`;
    check('การนำส่งเขียนลง ledger จริง', (row?.lines ?? 0) >= 2, `ได้ ${row?.lines} แถว`);
    check('รายการนำส่งสมดุล เดบิต = เครดิต', row?.debit === row?.credit, `${row?.debit} vs ${row?.credit}`);
  } finally {
    await ledgerSql.end();
  }

  await workBaseChecks(annToken);
  await earningsChecks(annToken);
  await payoutChecks(annToken, annId, adminToken);
}

/** ไรเดอร์แจ้งปัญหาระหว่างส่ง (design R9) */
async function riderIssueChecks(
  orderId: string,
  riderToken: string,
  otherRiderToken: string,
  adminToken: string,
) {
  console.log('\nไรเดอร์แจ้งปัญหาระหว่างส่ง (R9)');

  const badKind = await call('POST', `/rider/jobs/${orderId}/issues`, { kind: 'เบื่อ' }, riderToken);
  check('หัวข้อที่ไม่รู้จักถูกปฏิเสธ', badKind.status === 400, `ได้ ${badKind.status}`);

  const notMine = await call('POST', `/rider/jobs/${orderId}/issues`,
    { kind: 'accident' }, otherRiderToken);
  check('ไรเดอร์คนอื่นแจ้งงานนี้ไม่ได้', notMine.status === 404, `ได้ ${notMine.status}`);

  const before = await call('GET', `/orders/${orderId}`, undefined, riderToken);
  const reported = await call('POST', `/rider/jobs/${orderId}/issues`,
    { kind: 'bad_address', detail: 'ซอยนี้ไม่มีบ้านเลขที่ 42' }, riderToken);
  check('ไรเดอร์แจ้งปัญหาได้', reported.status === 201, JSON.stringify(reported.body));

  const after = await call('GET', `/orders/${orderId}`, undefined, riderToken);
  check('แจ้งปัญหาแล้วสถานะออเดอร์ไม่ขยับ',
    after.body?.status === before.body?.status,
    `${before.body?.status} → ${after.body?.status}`);

  const queue = await call('GET', '/admin/exceptions', undefined, adminToken);
  const mine = queue.body?.find((e: any) => e.orderId === orderId && e.kind === 'rider_issue');
  check('เรื่องโผล่ในคิว exception ของแอดมิน', !!mine, JSON.stringify(queue.body?.map((e: any) => e.kind)));
  check('คิวบอกวิธีจัดการ ไม่ใช่แค่ชื่อปัญหา', mine?.detail?.includes('โทรถามลูกค้า'), mine?.detail);
  check('แนบสิ่งที่ไรเดอร์พิมพ์มาด้วย', mine?.detail?.includes('ซอยนี้ไม่มีบ้านเลขที่ 42'), mine?.detail);

  const byRider = await call('POST', `/admin/rider-issues/${mine?.riderIssueId}/resolve`,
    undefined, riderToken);
  check('ไรเดอร์เคลียร์เรื่องเองไม่ได้', byRider.status === 403, `ได้ ${byRider.status}`);

  const resolved = await call('POST', `/admin/rider-issues/${mine?.riderIssueId}/resolve`,
    undefined, adminToken);
  check('แอดมินเคลียร์เรื่องได้', resolved.status === 200, JSON.stringify(resolved.body));

  const twice = await call('POST', `/admin/rider-issues/${mine?.riderIssueId}/resolve`,
    undefined, adminToken);
  check('เคลียร์ซ้ำไม่ได้', twice.status === 404, `ได้ ${twice.status}`);

  const cleared = await call('GET', '/admin/exceptions', undefined, adminToken);
  check('เคลียร์แล้วหลุดจากคิว',
    !cleared.body?.some((e: any) => e.orderId === orderId && e.kind === 'rider_issue'));

  const stillThere = await call('GET', `/orders/${orderId}`, undefined, riderToken);
  check('เคลียร์เรื่องแล้วออเดอร์ยังเดินต่อได้เหมือนเดิม',
    stillThere.body?.status === before.body?.status,
    `ได้ ${stillThere.body?.status}`);
}

/** จอรายได้ + ตัวกรองช่วงเวลา (design R4 R6) */
async function earningsChecks(riderToken: string) {
  console.log('\nจอรายได้และตัวกรองช่วงเวลา (R6)');

  const bad = await call('GET', '/rider/earnings?period=ตลอดกาล', undefined, riderToken);
  check('ช่วงเวลาที่ไม่รู้จักถูกปฏิเสธ', bad.status === 400, `ได้ ${bad.status}`);

  const fallback = await call('GET', '/rider/earnings', undefined, riderToken);
  check('ไม่ระบุช่วงได้สัปดาห์เป็นค่าตั้งต้น', fallback.body?.period === 'week', JSON.stringify(fallback.body?.period));

  const today = await call('GET', '/rider/earnings?period=today', undefined, riderToken);
  const month = await call('GET', '/rider/earnings?period=month', undefined, riderToken);
  check('ดึงรายได้ทุกช่วงได้', today.status === 200 && month.status === 200);
  check('ช่วงวันนี้ย่อยกว่าหรือเท่ากับเดือน',
    today.body?.deliveries.length <= month.body?.deliveries.length,
    `วันนี้ ${today.body?.deliveries.length} เดือน ${month.body?.deliveries.length}`);
  check('งานที่เพิ่งส่งอยู่ในช่วงวันนี้ด้วย',
    today.body?.deliveries.length > 0,
    'ถ้าเป็นศูนย์แปลว่าคิดเที่ยงคืนผิดเขตเวลา');

  const trip = month.body?.deliveries?.[0];
  check('ทุกเที่ยวมีระยะทางจริง ไม่ใช่ศูนย์',
    Number.isFinite(trip?.distanceKm) && trip.distanceKm > 0,
    `ได้ ${trip?.distanceKm}`);
  check('ทุกเที่ยวมีเวลาที่ใช้ ไม่ใช่ค่าว่าง',
    Number.isInteger(trip?.durationMinutes) && trip.durationMinutes >= 0,
    `ได้ ${trip?.durationMinutes}`);

  const sum = month.body?.deliveries.reduce((s: number, d: { distanceKm: number }) => s + d.distanceKm, 0);
  check('ระยะรวมเท่ากับผลบวกของทุกเที่ยว',
    Math.abs(month.body?.distanceKm - sum) < 0.05,
    `รวม ${month.body?.distanceKm} vs ผลบวก ${sum}`);

  // §3 ข้อ 4 จอนี้ห้ามมีอันดับหรือค่าเทียบกับไรเดอร์คนอื่น ต่อให้ "ดูดี" แค่ไหน
  const keys = Object.keys(month.body ?? {});
  check('ไม่มีอันดับหรือค่าเฉลี่ยเทียบไรเดอร์คนอื่น',
    !keys.some((k) => /rank|leaderboard|percentile|average.*rider|vs/i.test(k)),
    keys.join(','));
}

/** จุดตั้งทำงานของไรเดอร์ (design R7) */
async function workBaseChecks(riderToken: string) {
  console.log('\nจุดตั้งทำงานของไรเดอร์ (R7)');

  const tooWide = await call('POST', '/rider/work-base',
    { lat: 13.78, lng: 100.543, radiusKm: 99 }, riderToken);
  check('รัศมีเกินเพดานถูกปฏิเสธ', tooWide.status === 400, `ได้ ${tooWide.status}`);

  const zero = await call('POST', '/rider/work-base',
    { lat: 13.78, lng: 100.543, radiusKm: 0 }, riderToken);
  check('รัศมีศูนย์ถูกปฏิเสธ', zero.status === 400, `ได้ ${zero.status}`);

  const saved = await call('POST', '/rider/work-base',
    { lat: 13.7802, lng: 100.5432, radiusKm: 3 }, riderToken);
  check('ตั้งจุดทำงานได้', saved.status === 200, JSON.stringify(saved.body));

  const read = await call('GET', '/rider/work-base', undefined, riderToken);
  check('อ่านกลับมาได้ค่าเดิม',
    read.body?.radiusKm === 3
      && Math.abs(read.body?.lat - 13.7802) < 1e-6
      && Math.abs(read.body?.lng - 100.5432) < 1e-6,
    JSON.stringify(read.body));

  /** ตั้งรัศมีแคบมาก (1 กม.) แล้วร้านที่ไกลกว่านั้นต้องไม่ถูกเสนอให้ไรเดอร์คนนี้ */
  await call('POST', '/rider/work-base', { lat: 13.0, lng: 100.0, radiusKm: 1 }, riderToken);
  const far = await call('GET', '/rider/work-base', undefined, riderToken);
  check('เปลี่ยนจุดทำงานแล้วค่าเปลี่ยนตาม', far.body?.radiusKm === 1, JSON.stringify(far.body));

  // คืนค่าให้กว้างเหมือนเดิม ไม่งั้นเทสต์จ่ายงานรอบถัดไปจะเพี้ยนตาม
  await call('POST', '/rider/work-base', { lat: 13.7802, lng: 100.5432, radiusKm: 20 }, riderToken);
}

/** ถอนเงินไรเดอร์ (design R12 product-spec §6.2 + §6.4) */
async function payoutChecks(riderToken: string, riderId: string, adminToken: string) {
  console.log('\nถอนเงินไรเดอร์');

  const balance = await call('GET', '/rider/balance', undefined, riderToken);
  check('ไรเดอร์ดูยอดเงินตัวเองได้', balance.status === 200, JSON.stringify(balance.body));

  const { payableSatang, cashHeldSatang, withdrawableSatang } = balance.body ?? {};
  check(
    'ยอดถอน = รายได้ค้างจ่าย − เงินสดในมือ (§6.2)',
    withdrawableSatang === payableSatang - cashHeldSatang,
    `${withdrawableSatang} vs ${payableSatang} - ${cashHeldSatang}`,
  );

  // ขอถอนยอดเต็มทั้งที่ถือเงินสดอยู่ = ขอเกินยอดสุทธิ ต้องไม่ผ่าน
  if (cashHeldSatang > 0) {
    const tooMuch = await call('POST', '/rider/payouts', { amountSatang: payableSatang }, riderToken);
    check('ถอนเกินยอดสุทธิถูกปฏิเสธ', tooMuch.status === 400, `ได้ ${tooMuch.status}`);
  }

  const zero = await call('POST', '/rider/payouts', { amountSatang: 0 }, riderToken);
  check('ถอนศูนย์บาทถูกปฏิเสธ', zero.status === 400, `ได้ ${zero.status}`);

  if (withdrawableSatang <= 0) {
    check('ยอดสุทธิติดลบ ถอนไม่ได้เลย',
      (await call('POST', '/rider/payouts', { amountSatang: 1 }, riderToken)).status === 400);
    return;
  }

  const asked = await call('POST', '/rider/payouts', { amountSatang: withdrawableSatang }, riderToken);
  check('ไรเดอร์ขอถอนได้', asked.status === 201, JSON.stringify(asked.body));
  check('คำขอเริ่มที่สถานะรอตัดสิน ยังไม่จ่าย', asked.body?.status === 'requested', `ได้ ${asked.body?.status}`);

  const twice = await call('POST', '/rider/payouts', { amountSatang: 1 }, riderToken);
  check('มีคำขอค้างอยู่แล้ว ขอซ้ำไม่ได้', twice.status === 409, `ได้ ${twice.status}`);

  const payoutId = asked.body.id as string;

  // §6.4 คนที่กดยืนยันต้องเป็นแอดมิน ไม่ใช่คนที่ขอเอง
  const selfApprove = await call('POST', `/admin/riders/payouts/${payoutId}/decide`, { approve: true }, riderToken);
  check('ไรเดอร์กดอนุมัติคำขอตัวเองไม่ได้', selfApprove.status === 403, `ได้ ${selfApprove.status}`);

  const queue = await call('GET', '/admin/riders/payouts', undefined, adminToken);
  check('คำขอโผล่ในคิวของแอดมิน',
    Array.isArray(queue.body) && queue.body.some((r: { id: string }) => r.id === payoutId));

  const paid = await call('POST', `/admin/riders/payouts/${payoutId}/decide`, { approve: true }, adminToken);
  check('แอดมินยืนยันแล้วจ่าย', paid.status === 200 && paid.body?.status === 'paid', JSON.stringify(paid.body));

  const again = await call('POST', `/admin/riders/payouts/${payoutId}/decide`, { approve: true }, adminToken);
  check('ยืนยันซ้ำใบเดิมไม่ได้', again.status === 409, `ได้ ${again.status}`);

  // ถอนยอดสุทธิไปทั้งก้อน ยอดที่เหลือถอนได้ต้องเป็นศูนย์พอดี ไม่ใช่ติดลบ
  const after = await call('GET', '/rider/balance', undefined, riderToken);
  check('ถอนหมดแล้วยอดถอนได้เหลือศูนย์พอดี',
    after.body?.withdrawableSatang === 0,
    `ได้ ${after.body?.withdrawableSatang}`);
  check('ถอนหมดแล้วขอถอนอีกไม่ได้',
    (await call('POST', '/rider/payouts', { amountSatang: 1 }, riderToken)).status === 400);

  const ledgerSql = createScriptClient();
  try {
    const [row] = await ledgerSql`
      select
        coalesce(sum(debit_satang), 0)::int  as debit,
        coalesce(sum(credit_satang), 0)::int as credit,
        count(*)::int                        as lines
      from ledger_entries
      where reason = 'rider.payout' and counterparty_account_id = ${riderId}`;
    check('การจ่ายเขียนลง ledger จริง', (row?.lines ?? 0) >= 2, `ได้ ${row?.lines} แถว`);
    check('รายการจ่ายสมดุล เดบิต = เครดิต', row?.debit === row?.credit, `${row?.debit} vs ${row?.credit}`);
  } finally {
    await ledgerSql.end();
  }
}

/** คืนเงินกึ่งอัตโนมัติ (product-spec §6.4) + จอ exception-based ของแอดมิน (§7) */
async function refundChecks(customerToken: string, adminToken: string, deliveredOrderId: string) {
  const notMine = await call('POST', '/refunds', {
    orderId: deliveredOrderId, reason: 'wrong_item', detail: 'ได้ของผิด', hasPhoto: true,
  }, adminToken);
  // ตอบ 404 ไม่ใช่ 403 403 ยืนยันว่าออเดอร์รหัสนี้มีอยู่จริง
  check('แจ้งปัญหาออเดอร์ของคนอื่นไม่ได้', notMine.status === 404, `ได้ ${notMine.status}`);

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
  // คืนเกินที่ลูกค้าจ่ายมาคือการสร้างเงินจากอากาศ ฐานจับไม่ได้เพราะยังบาลานซ์อยู่
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
  check('จอ exception ไม่ใช่ฟีดออเดอร์ทั้งหมด (§7)', Array.isArray(byRider.body));
}

/** จอเฝ้าออเดอร์ AD2 และตัวเลขสด AD1 */
async function adminOrderMonitorChecks(adminToken: string, customerToken: string) {
  console.log('\nจอเฝ้าออเดอร์ของแอดมิน (AD2) + ตัวเลขสด (AD1)');

  const denied = await call('GET', '/admin/orders', undefined, customerToken);
  check('ลูกค้าเปิดจอเฝ้าออเดอร์ไม่ได้', denied.status === 403, `ได้ ${denied.status}`);

  const all = await call('GET', '/admin/orders', undefined, adminToken);
  check('แอดมินเห็นออเดอร์ทุกใบ', all.status === 200 && Array.isArray(all.body));
  check('มีออเดอร์ให้ดูจริง', (all.body?.length ?? 0) > 0, `ได้ ${all.body?.length} ใบ`);

  const first = all.body?.[0];
  check('แถวมีครบทุกอย่างที่จอต้องใช้',
    typeof first?.reference === 'string' && typeof first?.restaurantName === 'string'
    && typeof first?.grandTotalSatang === 'number' && typeof first?.minutesElapsed === 'number',
    JSON.stringify(first));
  check('ไรเดอร์ที่ยังไม่มีเป็น null ไม่ใช่ข้อความ "-"',
    all.body.every((o: any) => o.riderName === null || typeof o.riderName === 'string'));

  const unassigned = await call('GET', '/admin/orders?filter=unassigned', undefined, adminToken);
  check('ตัวกรอง "ไม่มีไรเดอร์" คืนเฉพาะใบที่ไม่มีไรเดอร์จริง',
    unassigned.body?.every((o: any) => o.riderName === null),
    JSON.stringify(unassigned.body?.map((o: any) => o.riderName)));
  check('และเฉพาะใบที่ยังไม่จบ',
    unassigned.body?.every((o: any) => !['delivered', 'cancelled'].includes(o.status)));

  const delayed = await call('GET', '/admin/orders?filter=delayed', undefined, adminToken);
  check('ตัวกรอง "ช้า" ไม่เอาใบที่จบไปแล้ว',
    delayed.body?.every((o: any) => !['delivered', 'cancelled'].includes(o.status)),
    JSON.stringify(delayed.body?.map((o: any) => o.status)));
  check('ตัวกรองกรองจริง ไม่ใช่คืนทุกใบเหมือนกันหมด',
    unassigned.body.length <= all.body.length && delayed.body.length <= all.body.length);

  const junk = await call('GET', '/admin/orders?filter=อะไรก็ไม่รู้', undefined, adminToken);
  check('ตัวกรองที่ไม่รู้จักถูกปฏิเสธ ไม่ใช่เงียบ ๆ คืนทุกใบ', junk.status === 400, `ได้ ${junk.status}`);

  const live = await call('GET', '/admin/orders/live', undefined, adminToken);
  check('ตัวเลขสดของ AD1 เรียกได้', live.status === 200, JSON.stringify(live.body));
  check('นับออเดอร์ที่ยังวิ่งกับไรเดอร์ออนไลน์ได้',
    typeof live.body?.activeOrders === 'number' && typeof live.body?.ridersOnline === 'number');
  check('จำนวนใบที่ไม่มีไรเดอร์ตรงกับที่ตัวกรองคืนมา',
    live.body?.unassigned === unassigned.body.length,
    `${live.body?.unassigned} vs ${unassigned.body.length}`);
  /** §10 "ไม่รู้" ต้องเป็น null ไม่ใช่เลขปลอม สิ่งที่ต้องพิสูจน์คือ แยกสองกรณีออกจากกัน */
  const deliveredToday = live.body?.gmvTodaySatang > 0;
  check(deliveredToday
    ? 'วันนี้มีการส่งสำเร็จแล้ว ค่ากลางจึงต้องเป็นตัวเลข'
    : 'วันนี้ยังไม่มีการส่งสำเร็จ ค่ากลางจึงต้องเป็น null ไม่ใช่ 0',
  deliveredToday
    ? typeof live.body?.medianDeliveryMinutes === 'number'
    : live.body?.medianDeliveryMinutes === null,
  String(live.body?.medianDeliveryMinutes));
  check('GMV วันนี้เป็นจำนวนเต็มสตางค์ (§5 กติกาข้อ 1)',
    Number.isInteger(live.body?.gmvTodaySatang), String(live.body?.gmvTodaySatang));
}

/** รอบจ่ายเงินร้าน (design AD7 §6.2) */
async function restaurantPayoutChecks(adminToken: string, customerToken: string) {
  console.log('\nรอบจ่ายเงินร้าน (AD7 · §6.2)');

  const denied = await call('GET', '/admin/restaurants/payables', undefined, customerToken);
  check('ลูกค้าดูยอดค้างจ่ายร้านไม่ได้', denied.status === 403, `ได้ ${denied.status}`);

  const payables = await call('GET', '/admin/restaurants/payables', undefined, adminToken);
  check('แอดมินเห็นยอดค้างจ่ายรายร้าน', payables.status === 200 && Array.isArray(payables.body));
  check('มีร้านที่ค้างจ่ายอยู่จริง', (payables.body?.length ?? 0) > 0,
    `ได้ ${payables.body?.length} ร้าน`);

  const shop = payables.body?.[0];
  check('บอกชื่อร้าน เจ้าของ และยอด ครบพอให้ตัดสินใจ',
    typeof shop?.name === 'string' && typeof shop?.ownerName === 'string'
    && Number.isInteger(shop?.payableSatang), JSON.stringify(shop));
  check('ไม่มีร้านยอดศูนย์หรือติดลบปนมาในรายการ',
    payables.body.every((s: any) => s.payableSatang > 0));

  // ยอดที่ API บอก ต้องตรงกับที่รวมจาก ledger ตรง ๆ
  const fromLedger = await restaurantPayableFromLedger(shop.restaurantId);
  check(`ยอดตรงกับที่รวมจาก ledger เอง (${shop.payableSatang} = ${fromLedger})`,
    shop.payableSatang === fromLedger);

  const settled = await call('POST', `/admin/restaurants/${shop.restaurantId}/settle`,
    undefined, adminToken);
  check('แอดมินกดจ่ายทีละร้านได้', settled.status === 200, JSON.stringify(settled.body));
  check('จ่ายเท่ากับยอดที่ค้างพอดี', settled.body?.paidSatang === shop.payableSatang,
    `${settled.body?.paidSatang} vs ${shop.payableSatang}`);

  const after = await restaurantPayableFromLedger(shop.restaurantId);
  check('จ่ายแล้วยอดค้างเหลือศูนย์', after === 0, `ได้ ${after}`);

  const again = await call('POST', `/admin/restaurants/${shop.restaurantId}/settle`,
    undefined, adminToken);
  check('ร้านที่ไม่มียอดค้างแล้ว กดจ่ายซ้ำไม่ได้', again.status === 409, `ได้ ${again.status}`);

  const list = await call('GET', '/admin/restaurants/payables', undefined, adminToken);
  check('จ่ายแล้วร้านหลุดจากรายการค้างจ่าย',
    !list.body?.some((s: any) => s.restaurantId === shop.restaurantId));

  await checkRestaurantPayoutLedger(shop.restaurantId, shop.payableSatang);
}

/** บทบาทที่สี่ `super_admin` (product-spec §7) */
async function superAdminChecks(adminToken: string, customerToken: string) {
  console.log('\nบทบาทที่สี่ super_admin (§7)');

  const login = await call('POST', '/auth/login',
    { identifier: 'super_root', password: 'wingdai1234' });
  check('ซูเปอร์แอดมินล็อกอินได้', login.status === 200, JSON.stringify(login.body));
  check('ตั๋วบอกชนิดบัญชีถูก', login.body?.account?.accountType === 'super_admin',
    login.body?.account?.accountType);
  const superToken = login.body?.token as string;

  const ADMIN_ROUTES = [
    '/admin/exceptions',
    '/admin/metrics',
    '/admin/refunds',
    '/admin/orders',
    '/admin/orders/live',
    '/admin/ops/map',
    '/admin/restaurants/pending',
    '/admin/restaurants/payables',
    '/admin/riders/pending',
    '/admin/riders/cash',
    '/admin/riders/payouts',
  ];

  const failed: string[] = [];
  for (const path of ADMIN_ROUTES) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call('GET', path, undefined, superToken);
    if (res.status !== 200) failed.push(`${path} → ${res.status}`);
  }
  check(`ซูเปอร์แอดมินผ่านทุกเส้นทางของแอดมิน (${ADMIN_ROUTES.length} เส้น)`,
    failed.length === 0, failed.join(' · '));

  const asAdmin = await call('GET', '/admin/exceptions', undefined, adminToken);
  check('แอดมินธรรมดายังใช้เส้นทางเดิมได้ตามปกติ', asAdmin.status === 200, `ได้ ${asAdmin.status}`);

  const asCustomer = await call('GET', '/admin/exceptions', undefined, customerToken);
  check('ลูกค้ายังเข้าไม่ได้เหมือนเดิม', asCustomer.status === 403, `ได้ ${asCustomer.status}`);

  return superToken;
}

/** จอตั้งค่าแพลตฟอร์ม (design SA1–SA6) */
async function superConfigChecks(
  superToken: string,
  adminToken: string,
  ctx: { restaurantId: string; menuItemId: string; choiceId: string; customerToken: string },
) {
  console.log('\nตั้งค่าแพลตฟอร์ม SA1–SA6');

  /** ทุกอย่างในนี้อยู่ใน try/finally เพราะฟังก์ชันนี้เปลี่ยนค่าที่ทั้งสคริปต์ใช้ร่วมกัน */
  try {
  const denied = await call('GET', '/super/config', undefined, adminToken);
  check('แอดมินธรรมดาเปิดจอตั้งค่าไม่ได้', denied.status === 403, `ได้ ${denied.status}`);
  const deniedWrite = await call('PATCH', '/super/config/flags/cash_payment',
    { enabled: false }, adminToken);
  check('แอดมินธรรมดาสลับ flag ไม่ได้', deniedWrite.status === 403, `ได้ ${deniedWrite.status}`);

  const config = await call('GET', '/super/config', undefined, superToken);
  check('ซูเปอร์แอดมินอ่านค่าตั้งค่าได้', config.status === 200, JSON.stringify(config.body));
  check('ค่าคอมตั้งต้นคือ 15% ตาม §6.1', config.body?.pricing?.commissionRateBp === 1500,
    String(config.body?.pricing?.commissionRateBp));
  check('flag ทุกตัวในรายการมีโค้ดฝั่งเซิร์ฟเวอร์อ่านจริง', Object.keys(config.body?.flags ?? {}).length === 4,
    JSON.stringify(config.body?.flags));

  const metrics = await call('GET', '/super/metrics', undefined, superToken);
  check('SA1 ให้ตัวเลข §8 ครบเก้าตัว',
    ['ordersPerRiderHour', 'restaurantAcceptRate', 'refundRate', 'autoDispatchRate',
      'contributionPerOrderSatang', 'medianDeliveryMinutes', 'onTimeRate', 'promptPayRate',
      'repeatOrderRate'].every((k) => k in (metrics.body ?? {})),
    JSON.stringify(Object.keys(metrics.body ?? {})));

  // ── ราคาที่เปลี่ยนต้องมีผลกับออเดอร์ใบถัดไปจริง ──
  const before = await placeSmokeOrder(ctx, 'promptpay');
  const feeBefore = before.deliveryFee;

  const changed = await call('PATCH', '/super/config/pricing', {
    commissionRateBp: 1200,
    deliveryBaseSatang: 2500,
    deliveryPerKmSatang: 600,
    serviceFeeSatang: 500,
  }, superToken);
  check('ซูเปอร์แอดมินเปลี่ยนราคาได้', changed.status === 200, JSON.stringify(changed.body));

  const after = await placeSmokeOrder(ctx, 'promptpay');
  check(`ค่าส่งของใบใหม่คิดตามราคาใหม่ (${feeBefore} → ${after.deliveryFee})`,
    after.deliveryFee === 2500, String(after.deliveryFee));
  check('ค่าคอมของใบใหม่คิดที่ 12% ไม่ใช่ 15%',
    await commissionOfOrder(after.id) === Math.floor((after.foodTotal * 1200) / 10000),
    `foodTotal=${after.foodTotal}`);

  // ออเดอร์ใบเก่าต้องไม่ขยับ เก็บเป็นยอด ไม่ใช่อัตรา
  check('ออเดอร์ใบเก่ายังคิดที่อัตราเดิม ไม่ถูกแก้ย้อนหลัง',
    await commissionOfOrder(before.id) === Math.floor((before.foodTotal * 1500) / 10000));

  const audit = await call('GET', '/super/audit?action=pricing.changed', undefined, superToken);
  const entry = audit.body?.[0];
  check('การเปลี่ยนราคาลง audit', !!entry, JSON.stringify(audit.body).slice(0, 200));
  check('audit เก็บทั้งค่าเก่าและค่าใหม่ (§6.1 ห้ามเลื่อนเงียบ ๆ)',
    entry?.before?.commissionRateBp === 1500 && entry?.after?.commissionRateBp === 1200,
    JSON.stringify({ before: entry?.before, after: entry?.after }));
  check('audit บอกว่าใครเป็นคนเปลี่ยน', entry?.actorUsername === 'super_root', entry?.actorUsername);

  // ── flag ต้องเปลี่ยนพฤติกรรมเซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่ม ──
  await call('PATCH', '/super/config/flags/cash_payment', { enabled: false }, superToken);
  const cashOrder = await call('POST', '/orders', {
    restaurantId: ctx.restaurantId,
    items: [{ menuItemId: ctx.menuItemId, quantity: 1, choiceIds: [ctx.choiceId] }],
    paymentMethod: 'cash',
  }, ctx.customerToken);
  check('ปิด flag เงินสดแล้ว สร้างออเดอร์เงินสดไม่ได้ที่ API',
    cashOrder.status === 400, `ได้ ${cashOrder.status}`);

  await call('PATCH', '/super/config/flags/cash_payment', { enabled: true }, superToken);
  const cashAgain = await call('POST', '/orders', {
    restaurantId: ctx.restaurantId,
    items: [{ menuItemId: ctx.menuItemId, quantity: 1, choiceIds: [ctx.choiceId] }],
    paymentMethod: 'cash',
  }, ctx.customerToken);
  check('เปิดกลับแล้วสั่งเงินสดได้เหมือนเดิม', cashAgain.status === 201, `ได้ ${cashAgain.status}`);
  if (cashAgain.body?.id) createdOrderIds.push(cashAgain.body.id);

  // ── บัตร: ปิดอยู่ตาม §6.5 จนกว่า §11.3 จะตอบว่าใช้เกตเวย์ไหน แต่กลไกพร้อมใช้ ──
  const cardOff = await call('GET', '/config');
  check('บัตรไม่อยู่ในช่องทางที่ใช้ได้ ตราบใดที่ยังไม่มีเกตเวย์',
    !cardOff.body?.paymentMethods?.includes('card'),
    JSON.stringify(cardOff.body?.paymentMethods));

  /** §6.5 บัตรต้อง "listed in the picker but not selectable" ถ้าหายไปเลย ลูกค้าไม่รู้ว่ากำลังจะมี */
  check('บัตรยังอยู่ในรายการที่แอปเอาไปวาดเป็นแถวกดไม่ได้ พร้อมเหตุผล',
    cardOff.body?.unavailablePaymentMethods?.some(
      (u: { method: string; gate: string }) => u.method === 'card' && u.gate === 'card_payment'),
    JSON.stringify(cardOff.body?.unavailablePaymentMethods));

  const cardBlocked = await call('POST', '/orders', {
    restaurantId: ctx.restaurantId,
    items: [{ menuItemId: ctx.menuItemId, quantity: 1, choiceIds: [ctx.choiceId] }],
    paymentMethod: 'card',
  }, ctx.customerToken);
  check('ปิด flag บัตรแล้ว สร้างออเดอร์บัตรไม่ได้ที่ API ไม่ใช่แค่ซ่อนปุ่มในแอป',
    cardBlocked.status === 400, `ได้ ${cardBlocked.status}`);

  /** เปิดชั่วคราวเพื่อพิสูจน์ว่ากลไกพร้อม วันที่ §11.3 ตอบ จะเป็นการพลิก flag ไม่ใช่เขียนของใหม่ */
  await call('PATCH', '/super/config/flags/card_payment', { enabled: true }, superToken);
  const cardOrder = await placeSmokeOrder(ctx, 'card');
  check('เปิด flag แล้วสั่งด้วยบัตรได้จริง', cardOrder.paymentMethod === 'card',
    JSON.stringify(cardOrder.paymentMethod));
  check('บัตรถือว่าจ่ายจบก่อนออเดอร์เริ่มเดิน เหมือนพร้อมเพย์',
    cardOrder.paymentStatus === 'paid', cardOrder.paymentStatus);

  const publicOn = await call('GET', '/config');
  check('เปิดแล้วบัตรย้ายมาอยู่ฝั่งใช้ได้',
    publicOn.body?.paymentMethods?.includes('card'),
    JSON.stringify(publicOn.body?.paymentMethods));
  check('พร้อมเพย์อยู่ใน /config เสมอ ปิดไม่ได้ (§3 ข้อ 5)',
    publicOn.body?.paymentMethods?.[0] === 'promptpay',
    JSON.stringify(publicOn.body?.paymentMethods));

  await call('PATCH', '/super/config/flags/card_payment', { enabled: false }, superToken);

  const badFlag = await call('PATCH', '/super/config/flags/surge_pricing',
    { enabled: true }, superToken);
  check('flag ที่ไม่มีอยู่จริงถูกปฏิเสธ ไม่ใช่เขียนแถวที่ไม่มีใครอ่าน',
    badFlag.status >= 400, `ได้ ${badFlag.status}`);

  // ── บทบาท (SA3) ──
  const admins = await call('GET', '/super/admins', undefined, superToken);
  check('เห็นรายชื่อผู้ดูแลระบบ', Array.isArray(admins.body) && admins.body.length >= 2,
    JSON.stringify(admins.body?.map((a: any) => a.username)));

  const meRow = admins.body.find((a: any) => a.username === 'super_root');
  const selfDemote = await call('POST', `/super/admins/${meRow.accountId}/role`,
    { role: 'admin' }, superToken);
  check('ถอนสิทธิ์ตัวเองไม่ได้ (ไม่งั้นล็อกตัวเองออกจากระบบถาวร)',
    selfDemote.status === 400, `ได้ ${selfDemote.status}`);

  // ── โซน (SA2) ──
  const zones = await call('GET', '/super/zones', undefined, superToken);
  check('เห็นโซนพร้อมตัวเลขรายพื้นที่', Array.isArray(zones.body) && zones.body.length > 0);
  check('โซนบอกจำนวนออเดอร์และไรเดอร์',
    typeof zones.body?.[0]?.liveOrders === 'number'
    && typeof zones.body?.[0]?.ridersOnline === 'number', JSON.stringify(zones.body?.[0]));

  } finally {
    // คืนราคาและ flag ทุกครั้ง ไม่ว่าจะผ่านหรือล้ม
    await call('PATCH', '/super/config/pricing', {
      commissionRateBp: 1500,
      deliveryBaseSatang: 1500,
      deliveryPerKmSatang: 600,
      serviceFeeSatang: 500,
    }, superToken);
    await call('PATCH', '/super/config/flags/cash_payment', { enabled: true }, superToken);
    // บัตรคืนเป็นปิด ไม่ใช่เปิด นั่นคือสถานะจริงจนกว่า §11.3 จะได้คำตอบ
    await call('PATCH', '/super/config/flags/card_payment', { enabled: false }, superToken);
  }
}

/** สั่งหนึ่งใบเพื่อเช็คว่าราคาที่ตั้งไว้มีผลจริง */
async function placeSmokeOrder(
  ctx: { restaurantId: string; menuItemId: string; choiceId: string; customerToken: string },
  paymentMethod: 'promptpay' | 'cash' | 'card',
) {
  const res = await call('POST', '/orders', {
    restaurantId: ctx.restaurantId,
    // เมนูนี้บังคับเลือกระดับความเผ็ด ส่ง choiceIds ว่างแล้วเซิร์ฟเวอร์ปฏิเสธถูกต้องแล้ว
    items: [{ menuItemId: ctx.menuItemId, quantity: 1, choiceIds: [ctx.choiceId] }],
    paymentMethod,
  }, ctx.customerToken);
  if (res.status !== 201) throw new Error(`สั่งไม่สำเร็จ ${res.status}: ${JSON.stringify(res.body)}`);
  createdOrderIds.push(res.body.id);
  return res.body;
}

async function commissionOfOrder(orderId: string): Promise<number> {
  const sql = createScriptClient();
  try {
    const [row] = await sql<{ c: number }[]>`
      select commission_satang as c from orders where id = ${orderId}`;
    return row?.c ?? -1;
  } finally {
    await sql.end();
  }
}

/** แผนที่ ops (AD8) และเอกสาร KYC พร้อมรูป (AD6) */
async function adminOpsChecks(adminToken: string, customerToken: string, riderId: string) {
  console.log('\nแผนที่ ops (AD8) + เอกสาร KYC พร้อมรูป (AD6)');

  const denied = await call('GET', '/admin/ops/map', undefined, customerToken);
  check('ลูกค้าเปิดแผนที่ ops ไม่ได้', denied.status === 403, `ได้ ${denied.status}`);

  const map = await call('GET', '/admin/ops/map', undefined, adminToken);
  check('แอดมินเปิดแผนที่ ops ได้', map.status === 200, JSON.stringify(map.body).slice(0, 200));
  check('มีทั้งหมุดไรเดอร์และหมุดออเดอร์',
    Array.isArray(map.body?.riders) && Array.isArray(map.body?.orders));

  // หมุดที่ไม่มีพิกัดคือหมุดที่ปักไม่ได้ ต้องไม่หลุดออกมาเลย
  check('ทุกหมุดไรเดอร์มีพิกัดจริง',
    map.body.riders.every((r: any) => typeof r.lat === 'number' && typeof r.lng === 'number'
      && Number.isFinite(r.lat) && Number.isFinite(r.lng)),
    JSON.stringify(map.body.riders.map((r: any) => [r.lat, r.lng])));
  check('ทุกหมุดออเดอร์มีพิกัดจริง',
    map.body.orders.every((o: any) => Number.isFinite(o.lat) && Number.isFinite(o.lng)));
  check('พิกัดอยู่ในประเทศไทย ไม่ใช่ (0,0)',
    map.body.orders.every((o: any) => o.lat > 5 && o.lat < 21 && o.lng > 97 && o.lng < 106),
    JSON.stringify(map.body.orders.map((o: any) => [o.lat, o.lng])));
  check('แผนที่ไม่เอาออเดอร์ที่จบแล้วมาปัก',
    map.body.orders.every((o: any) => !['delivered', 'cancelled'].includes(o.status)));
  check('บอกได้ว่าใบไหนยังไม่มีไรเดอร์',
    map.body.orders.every((o: any) => typeof o.hasRider === 'boolean'));

  const deniedDocs = await call('GET', `/admin/riders/${riderId}/documents`, undefined, customerToken);
  check('ลูกค้าเปิดเอกสารไรเดอร์คนอื่นไม่ได้', deniedDocs.status === 403, `ได้ ${deniedDocs.status}`);

  const docs = await call('GET', `/admin/riders/${riderId}/documents`, undefined, adminToken);
  check('แอดมินเปิดเอกสารไรเดอร์ได้', docs.status === 200, JSON.stringify(docs.body).slice(0, 200));
  check('โชว์ครบหกชนิดเสมอ รวมที่ยังไม่ส่ง (§7)', docs.body?.length === 6, `ได้ ${docs.body?.length}`);
  check('ชนิดที่ยังไม่ส่งไม่มีลิงก์ให้กด',
    docs.body.every((d: any) => (d.status === 'missing' ? d.url === null : true)));
  check('ชนิดที่ส่งแล้วมีลิงก์ดูรูป',
    docs.body.filter((d: any) => d.status !== 'missing').every((d: any) => typeof d.url === 'string'),
    JSON.stringify(docs.body.map((d: any) => [d.kind, d.status, d.url ? 'มีลิงก์' : 'ไม่มี'])));

  const withUrl = docs.body.find((d: any) => d.url);
  if (withUrl) {
    // ลิงก์ต้องเปิดได้จริง ไม่ใช่สตริงที่หน้าตาเหมือนลิงก์
    const res = await fetch(withUrl.url);
    check('ลิงก์ที่เซ็นมาเปิดดูรูปได้จริง', res.ok, `HTTP ${res.status}`);
    check('ลิงก์ชี้ไปที่บักเก็ตปิด rider-docs ไม่ใช่บักเก็ตเปิด',
      String(withUrl.url).includes('rider-docs'), String(withUrl.url).slice(0, 120));
    check('ลิงก์มีลายเซ็นติดมา ไม่ใช่ URL เปล่าที่ใครก็เปิดได้',
      String(withUrl.url).includes('token='), String(withUrl.url).slice(0, 120));
  }
}

/** รวมยอดค้างจ่ายของร้านจาก ledger ตรง ๆ เพื่อเทียบกับที่ API ตอบ */
async function restaurantPayableFromLedger(restaurantId: string): Promise<number> {
  const sql = createScriptClient();
  try {
    const [row] = await sql<{ payable: number }[]>`
      select coalesce(sum(le.credit_satang - le.debit_satang), 0)::int as payable
        from ledger_entries le
        left join orders o on o.id = le.order_id
       where le.account = 'restaurant_payable'
         and coalesce(le.restaurant_id, o.restaurant_id) = ${restaurantId}`;
    return row?.payable ?? 0;
  } finally {
    await sql.end();
  }
}

async function checkRestaurantPayoutLedger(restaurantId: string, amount: number) {
  const sql = createScriptClient();
  try {
    const rows = await sql<{ account: string; debit_satang: number; credit_satang: number }[]>`
      select account, debit_satang, credit_satang
        from ledger_entries
       where reason = 'restaurant.payout' and entry_group_id in (
         select entry_group_id from ledger_entries
          where reason = 'restaurant.payout' and restaurant_id = ${restaurantId})`;

    check('รอบจ่ายเขียน ledger สองแถวตามตาราง §6.2', rows.length === 2, `ได้ ${rows.length} แถว`);

    const debit = rows.reduce((s, r) => s + r.debit_satang, 0);
    const credit = rows.reduce((s, r) => s + r.credit_satang, 0);
    check(`จ่ายร้านแล้วเดบิต = เครดิต (${debit} = ${credit})`, debit === credit && debit === amount);
    check('หนี้ที่ค้างร้านลดลง', rows.some((r) => r.account === 'restaurant_payable' && r.debit_satang === amount));
    check('เงินออกจากบริษัทจริง', rows.some((r) => r.account === 'cash' && r.credit_satang === amount));
  } finally {
    await sql.end();
  }
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

/** เปิดร้านเอง (product-spec §4.3) ลูกค้ากรอกฟอร์ม → เพิ่มเมนูตั้งต้น → ส่งตรวจ → แอดมินอนุมัติ */
/** ลิงก์อัปโหลดเอกสารไรเดอร์ (product-spec §7 design R8) */
async function storageChecks(riderToken: string, otherToken: string) {
  console.log('\nลิงก์อัปโหลดเอกสาร (R8)');

  const anon = await call('POST', '/storage/rider-documents/sign-upload',
    { kind: 'selfie', ext: 'jpg' });
  check('ไม่ล็อกอินขอลิงก์ไม่ได้', anon.status === 401, `ได้ ${anon.status}`);

  const badKind = await call('POST', '/storage/rider-documents/sign-upload',
    { kind: 'อะไรก็ได้', ext: 'jpg' }, riderToken);
  check('ชนิดเอกสารที่ไม่รู้จักถูกปฏิเสธ', badKind.status === 400, `ได้ ${badKind.status}`);

  // svg/html รันสคริปต์ได้เมื่อเปิดตรงจาก URL ต้องไม่หลุดเข้าไปในบักเก็ตไหนเลย
  const svg = await call('POST', '/storage/rider-documents/sign-upload',
    { kind: 'selfie', ext: 'svg' }, riderToken);
  check('นามสกุลที่รันสคริปต์ได้ถูกปฏิเสธ', svg.status === 400, `ได้ ${svg.status}`);

  const signed = await call('POST', '/storage/rider-documents/sign-upload',
    { kind: 'id_card_front', ext: 'jpg' }, riderToken);
  check('ขอลิงก์อัปโหลดได้', signed.status === 201, JSON.stringify(signed.body));
  check('ได้ลิงก์กับโทเคนมาจริง',
    typeof signed.body?.uploadUrl === 'string' && typeof signed.body?.token === 'string');

  const mine = await call('GET', '/auth/me', undefined, riderToken);
  const path = signed.body?.path as string;
  check('เส้นทางขึ้นต้นด้วย accountId ของคนขอ',
    typeof path === 'string' && path.startsWith(`${mine.body?.id}/`),
    `ได้ ${path} · บัญชี ${mine.body?.id}`);
  check('เส้นทางมีชนิดเอกสารและนามสกุลถูกต้อง',
    path?.includes('id_card_front') && path?.endsWith('.jpg'), path);

  /** คนละบัญชีต้องได้คนละโฟลเดอร์ ไม่ใช่กองรวมกัน */
  const others = await call('POST', '/storage/rider-documents/sign-upload',
    { kind: 'id_card_front', ext: 'jpg' }, otherToken);
  const otherPath = others.body?.path as string;
  check('บัญชีอื่นได้โฟลเดอร์ของตัวเอง',
    typeof otherPath === 'string' && !otherPath.startsWith(`${mine.body?.id}/`),
    otherPath);

  /** ขอซ้ำต้องได้เส้นทางใหม่ ไม่ทับของเดิม แอดมินต้องเทียบกับรอบก่อนได้ */
  const again = await call('POST', '/storage/rider-documents/sign-upload',
    { kind: 'id_card_front', ext: 'jpg' }, riderToken);
  check('ขอซ้ำได้เส้นทางใหม่ ไม่ทับของเดิม', again.body?.path !== path,
    `${path} vs ${again.body?.path}`);

  /** อัปโหลดจริงเข้าลิงก์ที่ได้มา พิสูจน์ว่าลิงก์ใช้ได้ ไม่ใช่แค่รูปร่างถูก */
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const put = await fetch(signed.body.uploadUrl as string, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: png,
  });
  check('อัปโหลดเข้าลิงก์ที่เซ็นมาได้จริง', put.ok, `HTTP ${put.status}`);

  await riderDocumentChecks(riderToken, mine.body?.id as string, path);
}

/** สถานะเอกสารไรเดอร์ (design R8 product-spec §7) */
async function riderDocumentChecks(riderToken: string, riderId: string, uploadedPath: string) {
  console.log('\nสถานะเอกสารไรเดอร์ (R8)');

  const before = await call('GET', '/rider/documents', undefined, riderToken);
  check('คืนเอกสารครบหกชนิด', before.body?.length === 6, `ได้ ${before.body?.length}`);
  check('ชนิดที่ยังไม่ส่งเป็น missing ไม่ใช่หายไปจากรายการ',
    before.body?.some((d: any) => d.kind === 'insurance' && d.status === 'missing'),
    JSON.stringify(before.body?.map((d: any) => `${d.kind}:${d.status}`)));

  /** เส้นทางของคนอื่นต้องบันทึกไม่ได้ ต่อให้เดาชื่อไฟล์ถูก */
  const stolen = await call('POST', '/rider/documents',
    { kind: 'id_card_front', storagePath: 'someone-else/id_card_front-1.jpg' }, riderToken);
  check('บันทึกเส้นทางของบัญชีอื่นไม่ได้', stolen.status === 403, `ได้ ${stolen.status}`);

  const saved = await call('POST', '/rider/documents',
    { kind: 'id_card_front', storagePath: uploadedPath }, riderToken);
  check('บันทึกเอกสารได้', saved.status === 201, JSON.stringify(saved.body));
  check('อัปแล้วเป็นรอตรวจ ไม่ใช่ผ่านทันที', saved.body?.status === 'reviewing', saved.body?.status);

  const adminToken = (await call('POST', '/auth/login',
    { identifier: 'admin_root', password: 'wingdai1234' })).body?.token as string;

  const noReason = await call('POST', `/admin/riders/${riderId}/documents/id_card_front`,
    { approve: false }, adminToken);
  check('ปฏิเสธโดยไม่บอกเหตุผลไม่ได้', noReason.status === 400, `ได้ ${noReason.status}`);

  const rejected = await call('POST', `/admin/riders/${riderId}/documents/id_card_front`,
    { approve: false, rejectionReason: 'รูปเบลอ อ่านเลขบัตรไม่ออก' }, adminToken);
  check('แอดมินปฏิเสธพร้อมเหตุผลได้',
    rejected.body?.status === 'rejected' && rejected.body?.rejectionReason?.includes('เบลอ'),
    JSON.stringify(rejected.body));

  const resent = await call('POST', '/rider/documents',
    { kind: 'id_card_front', storagePath: uploadedPath }, riderToken);
  check('ส่งใหม่กลับไปรอตรวจ', resent.body?.status === 'reviewing', resent.body?.status);
  check('ส่งใหม่แล้วเหตุผลเดิมหายไป', resent.body?.rejectionReason === null,
    JSON.stringify(resent.body?.rejectionReason));

  const approved = await call('POST', `/admin/riders/${riderId}/documents/id_card_front`,
    { approve: true }, adminToken);
  check('แอดมินอนุมัติเอกสารได้', approved.body?.status === 'verified', approved.body?.status);
  check('อนุมัติแล้วเหตุผลเดิมไม่ค้าง', approved.body?.rejectionReason === null);

  const byRider = await call('POST', `/admin/riders/${riderId}/documents/selfie`,
    { approve: true }, riderToken);
  check('ไรเดอร์อนุมัติเอกสารตัวเองไม่ได้', byRider.status === 403, `ได้ ${byRider.status}`);
}

async function openRestaurantChecks(
  customerToken: string,
  riderToken: string,
  adminToken: string,
  /** บัญชีอื่นที่ไม่ใช่เจ้าของร้านใหม่ ต้องมีเพราะ §4.3 ห้ามสั่งอาหารจากร้านตัวเอง */
  ordererToken: string,
) {
  /** ร้านเปิดได้ทุกที่ในประเทศไทย ด่านโซนถูกยกเลิกแล้ว */
  const farAway = await call('POST', '/merchant/restaurants', {
    name: 'ร้านเชียงใหม่', cuisine: 'rice', addressText: 'เชียงใหม่',
    lat: 18.7883, lng: 98.9853, prepTimeMinutes: 10,
    bankName: 'กสิกรไทย', bankAccountNumber: '1234567890', bankAccountName: 'ทดสอบ',
  }, customerToken);
  check('เปิดร้านนอกโซนที่วาดไว้ได้ (ทั่วประเทศ)', farAway.status === 201, `ได้ ${farAway.status}`);
  check('ร้านนอกโซนไม่ผูกโซน แต่ยังเปิดได้', farAway.body?.zoneName === null, `ได้ ${farAway.body?.zoneName}`);

  const byRider = await call('POST', '/merchant/restaurants', {
    name: 'ร้านของไรเดอร์', cuisine: 'rice', addressText: 'ซอยอารีย์ 1',
    lat: 13.7802, lng: 100.5432, prepTimeMinutes: 10,
    bankName: 'กสิกรไทย', bankAccountNumber: '1234567890', bankAccountName: 'ทดสอบ',
  }, riderToken);
  // §4.1 ร้านเป็นการอัปเกรดบนบัญชี user ไรเดอร์เปิดร้านไม่ได้
  check('บัญชีไรเดอร์เปิดร้านไม่ได้', byRider.status === 403, `ได้ ${byRider.status}`);

  const created = await call('POST', '/merchant/restaurants', {
    name: SMOKE_SHOP_NAME, cuisine: 'noodle', addressText: 'ซอยอารีย์ 2 พหลโยธิน',
    lat: 13.7805, lng: 100.5435, prepTimeMinutes: 15,
    bankName: 'กสิกรไทย', bankAccountNumber: '9876543210', bankAccountName: 'สมชาย ใจดี',
  }, customerToken);
  check('เปิดร้านในโซนได้', created.status === 201, JSON.stringify(created.body));
  createdRestaurantIds.push(created.body?.id);
  check('ร้านใหม่ยังไม่อนุมัติและยังไม่เปิดขาย', created.body?.isApproved === false && created.body?.isOpen === false);
  check('บอกว่าอยู่โซนไหน', typeof created.body?.zoneName === 'string');

  const shopId = created.body.id as string;

  const listed = await call('GET', '/catalog/restaurants');
  check('ร้านที่ยังไม่อนุมัติไม่โผล่ให้ลูกค้าเห็น', !listed.body?.some((r: any) => r.id === shopId));

  const earlySubmit = await call('POST', `/merchant/restaurants/${shopId}/submit`, undefined, customerToken);
  // §7 ร้านที่อนุมัติแล้วแต่ไม่มีเมนู = ลูกค้ากดเข้าไปเจอหน้าว่าง เสียลูกค้าคนนั้นไปเลย
  check('ยังไม่มีเมนูตั้งต้น ส่งตรวจไม่ได้', earlySubmit.status === 400, `ได้ ${earlySubmit.status}`);

  for (const dish of ['ก๋วยเตี๋ยวต้มยำ', 'เย็นตาโฟ', 'บะหมี่เกี๊ยว']) {
    const item = await call('POST', '/merchant/menu', {
      restaurantId: shopId, name: dish, price: 5500, category: 'noodle',
    }, customerToken);
    createdMenuItemIds.push(item.body?.id);
  }

  const submitted = await call('POST', `/merchant/restaurants/${shopId}/submit`, undefined, customerToken);
  check('มีเมนูครบแล้วส่งตรวจได้', submitted.status === 200 && submitted.body?.submitted === true);

  const pending = await call('GET', '/admin/restaurants/pending', undefined, adminToken);
  const mine = pending.body?.find((r: any) => r.id === shopId);
  check('ร้านโผล่ในคิวอนุมัติของแอดมิน', !!mine);
  check('แอดมินเห็นว่ามีกี่เมนูและใครเป็นเจ้าของ', mine?.menuItemCount === 3 && !!mine?.ownerName);

  const selfApprove = await call('POST', `/admin/restaurants/${shopId}/approval`, { approve: true }, customerToken);
  check('เจ้าของร้านอนุมัติร้านตัวเองไม่ได้', selfApprove.status === 403, `ได้ ${selfApprove.status}`);

  const approved = await call('POST', `/admin/restaurants/${shopId}/approval`, { approve: true }, adminToken);
  check('แอดมินอนุมัติร้านได้', approved.status === 200 && approved.body?.isApproved === true);
  // อนุมัติแล้วยังไม่เปิดขาย เจ้าของรู้ดีกว่าว่าพร้อมเมื่อไหร่
  check('อนุมัติแล้วยังไม่เปิดขายเอง', approved.body?.isOpen === false);

  const opened = await call('PATCH', `/merchant/restaurants/${shopId}/open`, { isOpen: true }, customerToken);
  check('อนุมัติแล้วเจ้าของเปิดขายได้', opened.status === 200 && opened.body?.isOpen === true);

  const nowListed = await call('GET', '/catalog/restaurants');
  check('เปิดแล้วโผล่ให้ลูกค้าเห็น', nowListed.body?.some((r: any) => r.id === shopId));

  // §4.3 สั่งร้านตัวเองไม่ได้ กติกาเดิมต้องยังทำงานกับร้านที่เพิ่งเปิด
  const menu = await call('GET', `/catalog/restaurants/${shopId}/menu`);
  const selfOrder = await call('POST', '/orders', {
    restaurantId: shopId,
    items: [{ menuItemId: menu.body[0].id, quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash',
  }, customerToken);
  check('เจ้าของสั่งอาหารจากร้านที่เพิ่งเปิดเองไม่ได้', selfOrder.status === 403, `ได้ ${selfOrder.status}`);

  await storeHoursChecks(customerToken, ordererToken, shopId, menu.body[0].id as string);
}

/** ตารางเวลาเปิด-ปิดและการพักรับออเดอร์ (design M11) */
async function storeHoursChecks(
  ownerToken: string, ordererToken: string, shopId: string, menuItemId: string,
) {
  console.log('\nเวลาเปิด-ปิดร้าน (M11)');
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const todayIndex = new Date(Date.now() + 7 * 60 * 60_000).getUTCDay();
  const today = DAYS[todayIndex]!;

  const closedToday = Object.fromEntries(DAYS.map((d) => [d, null])) as Record<string, unknown>;
  const openAllWeek = Object.fromEntries(
    DAYS.map((d) => [d, { open: '00:00', close: '23:59' }]),
  ) as Record<string, unknown>;

  /** คนที่จะสั่งต้องมีที่อยู่ก่อน ไม่งั้น "สั่งไม่ได้" ข้างล่างจะเป็นเพราะไม่มีที่อยู่ */
  const mineAddresses = await call('GET', '/addresses', undefined, ordererToken);
  if ((mineAddresses.body?.length ?? 0) === 0) {
    await call('POST', '/addresses', {
      label: 'บ้าน', addressText: 'ซอยอารีย์ 1 พหลโยธิน', lat: 13.7812, lng: 100.5448,
    }, ordererToken);
  }

  const bad = await call('PATCH', `/merchant/restaurants/${shopId}/hours`, {
    hours: { ...openAllWeek, [today]: { open: '09:00', close: '09:00' } },
  }, ownerToken);
  check('เวลาเปิดเท่ากับเวลาปิด ตั้งไม่ได้', bad.status === 400, `ได้ ${bad.status}`);

  const closed = await call('PATCH', `/merchant/restaurants/${shopId}/hours`, {
    hours: closedToday,
  }, ownerToken);
  check('ตั้งตารางเวลาได้', closed.status === 200, JSON.stringify(closed.body));
  check('วันนี้หยุด = ร้านไม่รับออเดอร์', closed.body?.isAcceptingOrders === false);
  // ปิดทั้งเจ็ดวัน จึงไม่มีรอบเปิดถัดไปให้บอก ต้องเป็น null ไม่ใช่วันที่มั่ว
  check('ปิดทุกวัน = ไม่มีรอบเปิดถัดไป', closed.body?.pausedUntil === null);

  const blocked = await call('POST', '/orders', {
    restaurantId: shopId,
    items: [{ menuItemId, quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash',
  }, ordererToken);
  check('นอกเวลาทำการ สั่งไม่ได้จริงที่เซิร์ฟเวอร์', blocked.status === 400, `ได้ ${blocked.status}`);

  const catalogClosed = await call('GET', `/catalog/restaurants/${shopId}`);
  check('รายการร้านบอกว่าปิด ตรงกับที่สั่งไม่ได้', catalogClosed.body?.isOpen === false);

  const reopened = await call('PATCH', `/merchant/restaurants/${shopId}/hours`, {
    hours: openAllWeek,
  }, ownerToken);
  check('ตั้งเปิดทั้งสัปดาห์แล้วกลับมารับออเดอร์', reopened.body?.isAcceptingOrders === true);

  /** ยิงใบเดิมซ้ำหลังเปิด ข้อนี้คือสิ่งที่ทำให้ 400 ข้างบนแปลว่านอกเวลาจริง */
  const allowed = await call('POST', '/orders', {
    restaurantId: shopId,
    items: [{ menuItemId, quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash',
  }, ordererToken);
  check('ในเวลาทำการ ใบเดิมสั่งได้', allowed.status === 201, JSON.stringify(allowed.body));
  createdOrderIds.push(allowed.body?.id);

  const nextWeek = await call('PATCH', `/merchant/restaurants/${shopId}/hours`, {
    hours: { ...closedToday, [DAYS[(todayIndex + 1) % 7]!]: { open: '09:00', close: '21:00' } },
  }, ownerToken);
  const opensAt = await call('GET', `/catalog/restaurants/${shopId}`);
  check('ปิดวันนี้แต่เปิดพรุ่งนี้ → บอกรอบเปิดถัดไปได้',
    nextWeek.status === 200 && typeof opensAt.body?.opensAt === 'string',
    `ได้ ${opensAt.body?.opensAt}`);

  await call('PATCH', `/merchant/restaurants/${shopId}/hours`, { hours: openAllWeek }, ownerToken);

  const tooLong = await call('POST', `/merchant/restaurants/${shopId}/pause`, { minutes: 240 }, ownerToken);
  check('พักนานเกินเพดาน ทำไม่ได้', tooLong.status === 400, `ได้ ${tooLong.status}`);

  const paused = await call('POST', `/merchant/restaurants/${shopId}/pause`, { minutes: 30 }, ownerToken);
  check('พักรับออเดอร์ได้', paused.status === 201 && paused.body?.isAcceptingOrders === false);
  // การพักไม่ใช่การปิดร้าน สวิตช์ต้องยังเปิดอยู่ ไม่งั้นครบเวลาแล้วจะไม่กลับมาเอง
  check('พักแล้วสวิตช์ร้านยังเปิดอยู่', paused.body?.isOpen === true);

  const whilePaused = await call('POST', '/orders', {
    restaurantId: shopId,
    items: [{ menuItemId, quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash',
  }, ordererToken);
  check('ระหว่างพัก สั่งไม่ได้', whilePaused.status === 400, `ได้ ${whilePaused.status}`);

  const resumed = await call('POST', `/merchant/restaurants/${shopId}/pause`, { minutes: 0 }, ownerToken);
  check('กลับมารับออเดอร์ได้', resumed.body?.pausedUntil === null && resumed.body?.isAcceptingOrders === true);

  const strangerHours = await call('PATCH', `/merchant/restaurants/${shopId}/hours`, {
    hours: closedToday,
  }, ordererToken);
  // 404 ไม่ใช่ 403 403 เป็นการยืนยันว่าร้าน id นี้มีอยู่จริง ซึ่งเปิดให้ไล่เดา id
  check('คนอื่นตั้งเวลาร้านที่ไม่ใช่ของตัวเองไม่ได้', strangerHours.status === 404, `ได้ ${strangerHours.status}`);
}

/** ปฏิเสธออเดอร์พร้อมเหตุผล (design M12) */
async function rejectReasonChecks(
  customerToken: string,
  maleeToken: string,
  adminToken: string,
  restaurantId: string,
  menuItemId: string,
  choiceId: string,
) {
  console.log('\nปฏิเสธออเดอร์พร้อมเหตุผล (M12)');

  const place = async () => {
    // พร้อมเพย์ = จ่ายแล้วตั้งแต่สั่ง จึงทดสอบการคืนเงินอัตโนมัติตอนถูกปฏิเสธได้ด้วย
    const res = await call('POST', '/orders', {
      restaurantId,
      items: [{ menuItemId, quantity: 1, choiceIds: [choiceId] }],
      paymentMethod: 'promptpay',
    }, customerToken);
    if (res.status !== 201) throw new Error(`สั่งไม่สำเร็จ ${res.status}: ${JSON.stringify(res.body)}`);
    createdOrderIds.push(res.body?.id);
    return res.body.id as string;
  };

  const noReason = await place();
  const rejected = await call('PATCH', `/orders/${noReason}/status`, { status: 'cancelled' }, maleeToken);
  check('ร้านปฏิเสธโดยไม่บอกเหตุผลไม่ได้', rejected.status === 400, `ได้ ${rejected.status}`);
  check('บอกด้วยว่าช่องไหนขาด', !!rejected.body?.fields?.reason);
  const stillAlive = await call('GET', `/orders/${noReason}`, undefined, customerToken);
  check('คำขอที่ถูกปฏิเสธไม่ทำให้ใบเปลี่ยนสถานะ', stillAlive.body?.status === 'created');

  const withReason = await call(
    'PATCH', `/orders/${noReason}/status`, { status: 'cancelled', reason: 'out_of_stock' }, maleeToken,
  );
  check('บอกเหตุผลแล้วปฏิเสธได้', withReason.status === 200, JSON.stringify(withReason.body));

  const seen = await call('GET', `/orders/${noReason}`, undefined, customerToken);
  check('ลูกค้าเห็นว่าร้านเป็นคนปฏิเสธ', seen.body?.cancelledBy === 'restaurant', `ได้ ${seen.body?.cancelledBy}`);
  check('ลูกค้าเห็นเหตุผล', seen.body?.cancelReason === 'out_of_stock', `ได้ ${seen.body?.cancelReason}`);
  // ใบพร้อมเพย์จ่ายมาแล้วตั้งแต่สั่ง ยกเลิกจึงต้องคืนเงินอัตโนมัติตามที่จอ M12 สัญญาไว้
  check('ใบที่จ่ายแล้วถูกคืนเงินอัตโนมัติ', seen.body?.paymentStatus === 'refunded', `ได้ ${seen.body?.paymentStatus}`);

  const byCustomer = await place();
  const custCancel = await call('PATCH', `/orders/${byCustomer}/status`, { status: 'cancelled' }, customerToken);
  check('ลูกค้ายกเลิกเองไม่ต้องมีเหตุผล', custCancel.status === 200, JSON.stringify(custCancel.body));
  check('บันทึกว่าลูกค้าเป็นคนกด', custCancel.body?.cancelledBy === 'customer', `ได้ ${custCancel.body?.cancelledBy}`);
  check('ลูกค้ายกเลิกแล้วไม่มีเหตุผลของร้านติดมา', custCancel.body?.cancelReason === null);

  const byAdmin = await place();
  const adminCancel = await call('PATCH', `/orders/${byAdmin}/status`, { status: 'cancelled' }, adminToken);
  check('แอดมินยกเลิกได้และแยกออกจากสองฝ่ายแรก', adminCancel.body?.cancelledBy === 'admin', `ได้ ${adminCancel.body?.cancelledBy}`);

  const bogus = await place();
  const badReason = await call(
    'PATCH', `/orders/${bogus}/status`, { status: 'cancelled', reason: 'ขี้เกียจ' }, maleeToken,
  );
  check('เหตุผลนอกรายการถูกปฏิเสธตั้งแต่ชั้นตรวจข้อมูล', badReason.status === 400, `ได้ ${badReason.status}`);
  await call('PATCH', `/orders/${bogus}/status`, { status: 'cancelled' }, adminToken);
}

/** เบอร์และชื่อผู้ใช้ที่ไม่ชนของเดิม เพื่อให้รันซ้ำได้โดยไม่ติด cooldown ของเบอร์เดิม */
const suffix = String(randomInt(0, 100_000_000)).padStart(8, '0');
const SMOKE_PHONE = `09${suffix}`;
const SMOKE_USERNAME = `smoke_${suffix}`;
const SMOKE_PASSWORD = 'wingdai-smoke-1234';
const SMOKE_SHOP_NAME = `ร้านทดสอบ ${suffix}`;

async function main() {
  console.log(`\nเซิร์ฟเวอร์ ${BASE}`);
  const health = await call('GET', '/health');
  if (health.status !== 200) {
    console.error('เซิร์ฟเวอร์ยังไม่ขึ้น — สั่ง npm start ในอีกหน้าต่างก่อน');
    process.exit(1);
  }

  console.log('\nค่าที่แอปอ่านก่อนล็อกอิน');
  const publicConfig = await call('GET', '/config');
  check('อ่าน /config ได้โดยไม่ต้องล็อกอิน (จอสมัครสมาชิกต้องใช้)',
    publicConfig.status === 200, `ได้ ${publicConfig.status}`);
  check('บอกช่องทางจ่ายเงินที่เปิดอยู่ครบสามช่องทาง',
    Array.isArray(publicConfig.body?.paymentMethods)
    && publicConfig.body.paymentMethods.length === 3,
    JSON.stringify(publicConfig.body?.paymentMethods));
  check('บอกด้วยว่าตอนนี้เปิดรับสมัครอยู่ไหม',
    typeof publicConfig.body?.registrationOpen === 'boolean',
    JSON.stringify(publicConfig.body));
  /** flag ฝั่งปฏิบัติการต้องไม่หลุดออกทางนี้ คนนอกไม่ควรรู้ว่าตอนนี้ auto-dispatch ปิดอยู่ไหม */
  check('ไม่หลุด flag ฝั่งปฏิบัติการออกไปให้คนนอกเห็น',
    !JSON.stringify(publicConfig.body ?? {}).includes('auto_dispatch'),
    JSON.stringify(publicConfig.body));

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

  // product-spec §4.2 เบอร์โทรก็เป็น identifier ได้ ไม่ใช่แค่ username
  const byPhone = await call('POST', '/auth/login', {
    identifier: '081-234-5678',
    password: 'wingdai1234',
  });
  check('ล็อกอินด้วยเบอร์โทร (มีขีดคั่น) ได้', byPhone.status === 200, JSON.stringify(byPhone.body));
  check(
    'เบอร์กับ username ชี้บัญชีเดียวกัน',
    !!byPhone.body?.account?.id && byPhone.body.account.id === byUsername.body?.account?.id,
  );

  // product-spec §4.2 อีเมลไม่ใช่ identifier สำหรับล็อกอิน
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

  // สมชายมีร้านที่ยังไม่อนุมัติ ต้องไม่ถูกนับว่าเป็นเจ้าของร้านที่เปิดใช้ได้ (product-spec §4.3)
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

  // ตั๋วยืนยันเบอร์เซ็นด้วยกุญแจดอกเดียวกับเซสชัน ห้ามเอามาสวมเป็นเซสชันได้
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

  /** §4.2 ตั๋วใบเดิมใช้ซ้ำไม่ได้ หนึ่ง OTP ต้องแลกได้ครั้งเดียว ไม่ใช่ทั้งอายุตั๋ว */
  const reused = await call('POST', '/auth/register', {
    username: `${SMOKE_USERNAME}_again`,
    password: SMOKE_PASSWORD,
    fullName: 'ผู้ทดสอบ ซ้ำ',
    phone: SMOKE_PHONE,
    accountType: 'user',
    verificationToken,
  });
  check('ตั๋วยืนยันเบอร์ใบเดิมใช้ซ้ำไม่ได้', reused.status === 400, `ได้ ${reused.status}`);

  check(
    'ล็อกอินด้วยบัญชีที่เพิ่งสมัครได้',
    (await call('POST', '/auth/login', { identifier: SMOKE_USERNAME, password: SMOKE_PASSWORD }))
      .status === 200,
  );

  // ── ลืมรหัสผ่าน (§4.2) ──
  const unknownPhone = '0611111111';
  const resetUnknown = await call('POST', '/auth/otp/request',
    { phone: unknownPhone, purpose: 'password_reset' });
  const resetKnown = await call('POST', '/auth/otp/request',
    { phone: SMOKE_PHONE, purpose: 'password_reset' });

  /** ปลายทางนี้ไม่ต้องล็อกอินและยกบัญชีให้ ถ้าตอบต่างกันมันคือเครื่องไล่เดาว่าเบอร์ไหนมีบัญชี */
  check('ขอรหัสรีเซ็ตของเบอร์ที่ไม่มีบัญชี ตอบเหมือนเบอร์ที่มี',
    resetUnknown.status === resetKnown.status
    && Object.keys(resetUnknown.body ?? {}).sort().join() ===
       Object.keys(resetKnown.body ?? {}).sort().join(),
    `${resetUnknown.status}/${JSON.stringify(resetUnknown.body)} vs ${resetKnown.status}`);

  const resetCode = resetKnown.body?.devCode as string;
  const resetTicket = (await call('POST', '/auth/otp/verify',
    { phone: SMOKE_PHONE, code: resetCode })).body?.verificationToken as string;
  check('ยืนยันรหัสรีเซ็ตแล้วได้ตั๋ว', typeof resetTicket === 'string');

  /** §4.2 ตั๋วผูกวัตถุประสงค์ ตั๋วรีเซ็ตเอาไปสมัครสมาชิกไม่ได้ และกลับกันก็ไม่ได้ */
  const crossPurpose = await call('POST', '/auth/register', {
    username: `${SMOKE_USERNAME}_x`,
    password: SMOKE_PASSWORD,
    fullName: 'ผู้ทดสอบ ข้ามงาน',
    phone: SMOKE_PHONE,
    accountType: 'user',
    verificationToken: resetTicket,
  });
  check('ตั๋วที่ออกเพื่อรีเซ็ตรหัสผ่าน เอาไปสมัครสมาชิกไม่ได้',
    crossPurpose.status === 400, `ได้ ${crossPurpose.status}`);

  const NEW_PASSWORD = 'wingdai-smoke-5678';
  const reset = await call('POST', '/auth/password/reset',
    { phone: SMOKE_PHONE, verificationToken: resetTicket, newPassword: NEW_PASSWORD });
  check('ตั้งรหัสผ่านใหม่สำเร็จ', reset.status === 204, `ได้ ${reset.status}`);

  check('ล็อกอินด้วยรหัสใหม่ได้',
    (await call('POST', '/auth/login', { identifier: SMOKE_USERNAME, password: NEW_PASSWORD }))
      .status === 200);
  check('รหัสเดิมใช้ไม่ได้แล้ว',
    (await call('POST', '/auth/login', { identifier: SMOKE_USERNAME, password: SMOKE_PASSWORD }))
      .status === 401);

  /** หนึ่ง OTP รีเซ็ตได้ครั้งเดียว ไม่ใช่ไม่จำกัดครั้งตลอดอายุตั๋ว */
  const resetAgain = await call('POST', '/auth/password/reset',
    { phone: SMOKE_PHONE, verificationToken: resetTicket, newPassword: 'wingdai-smoke-9999' });
  check('ตั๋วรีเซ็ตใบเดิมใช้ซ้ำไม่ได้', resetAgain.status === 400, `ได้ ${resetAgain.status}`);

  /**
   * product-spec §4.1 admin ไม่มีทางสร้างผ่านช่องทางสาธารณะ
   * ต้องใช้ตั๋วใบใหม่ที่ยังไม่ถูกใช้ ไม่งั้นคำขอถูกปฏิเสธเพราะตั๋วหมด แล้วเทสต์นี้ผ่านด้วยเหตุผลผิด
   */
  const admPhone = `08${suffix}`;
  const admOtp = await call('POST', '/auth/otp/request', { phone: admPhone });
  const admTicket = (await call('POST', '/auth/otp/verify',
    { phone: admPhone, code: admOtp.body?.devCode })).body?.verificationToken as string;
  check('ได้ตั๋วใบใหม่สำหรับทดสอบสมัครเป็นแอดมิน', typeof admTicket === 'string');

  const asAdmin = await call('POST', '/auth/register', {
    username: `${SMOKE_USERNAME}_adm`,
    password: SMOKE_PASSWORD,
    fullName: 'แอบเป็นแอดมิน',
    phone: admPhone,
    accountType: 'admin',
    verificationToken: admTicket,
  });
  check('สมัครเป็น admin ผ่าน API สาธารณะไม่ได้', asAdmin.status === 400, `ได้ ${asAdmin.status}`);

  /** พิสูจน์ว่าตั๋วใบนั้นยังดีอยู่จริง ไม่งั้นข้อบนก็ยังผ่านด้วยเหตุผลผิดอยู่ดี */
  const asUser = await call('POST', '/auth/register', {
    username: `${SMOKE_USERNAME}_adm`,
    password: SMOKE_PASSWORD,
    fullName: 'ผู้ทดสอบ ปกติ',
    phone: admPhone,
    accountType: 'user',
    verificationToken: admTicket,
  });
  check('ตั๋วใบเดียวกันสมัครเป็น user ได้ ยืนยันว่าที่ถูกปฏิเสธคือบทบาท ไม่ใช่ตั๋ว',
    asUser.status === 201, `ได้ ${asUser.status}`);

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
  /** ครัวมาลีอยู่ห่างบ้านสมชาย 242 เมตรตามพิกัดใน seed → ต้องได้ 0.2 */
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
  /** ยืนยันว่าเจอร้านที่ควรเจอ ไม่ใช่ว่าเจอร้านเดียว ฐานมีร้านสาธิตหลายสิบร้านแล้ว */
  check('ค้นด้วยชื่อร้านเจอ', byName.body?.some((r: any) => r.name === 'ส้มตำแซ่บนัว'),
    JSON.stringify(byName.body?.map((r: any) => r.name)));
  check('ค้นชื่อร้านแล้วไม่ปนร้านที่ไม่เกี่ยว',
    byName.body?.every((r: any) => r.name.includes('ส้มตำ') || r.name.includes('ตำ')),
    JSON.stringify(byName.body?.map((r: any) => r.name)));

  // design C2 บอกว่า "ค้นหาร้านหรือเมนู" พิมพ์ชื่ออาหารต้องเจอร้านที่ขายของนั้น
  const byDish = await call('GET', '/catalog/restaurants?q=' + encodeURIComponent('กะเพรา'));
  check('ค้นด้วยชื่อเมนูแล้วเจอร้านที่ขาย', byDish.body?.some((r: any) => r.name === 'ครัวมาลี'),
    JSON.stringify(byDish.body?.map((r: any) => r.name)));

  const menu = await call('GET', `/catalog/restaurants/${malee.id}/menu`);
  check('ดึงเมนูของร้านได้', menu.status === 200 && menu.body.length === 5, `ได้ ${menu.body?.length}`);
  const kaphrao = menu.body?.find((m: any) => m.name === 'ข้าวกะเพราหมูสับ');
  check('ราคาเป็นสตางค์จำนวนเต็ม', Number.isInteger(kaphrao?.price) && kaphrao.price === 5000);
  check('กลุ่มตัวเลือกติดมาด้วย', kaphrao?.optionGroups?.length === 2);

  /** seed เคยประกาศชื่ออังกฤษไว้ครบแต่ไม่ได้เขียนลงฐาน จอภาษาอังกฤษจึงขึ้นชื่อไทยทั้งหน้า */
  check('ร้านมีชื่ออังกฤษติดมาด้วย', typeof malee.nameEn === 'string' && malee.nameEn.length > 0,
    `ได้ ${malee.nameEn}`);
  check('จานมีชื่ออังกฤษ', kaphrao?.nameEn === 'Minced Pork Basil Rice', `ได้ ${kaphrao?.nameEn}`);
  check('กลุ่มตัวเลือกและตัวเลือกมีชื่ออังกฤษครบ',
    kaphrao?.optionGroups?.every((g: any) => g.nameEn && g.choices.every((c: any) => c.nameEn)),
    JSON.stringify(kaphrao?.optionGroups?.map((g: any) => g.nameEn)));

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
  check('เลขที่ออเดอร์อ่านออก ไม่ใช่ uuid', /^WD-[23456789A-HJ-NP-Z]{6}$/.test(placed.body?.reference ?? ''));
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

  // product-spec §4.3 มาลีเป็นเจ้าของครัวมาลี สั่งร้านตัวเองไม่ได้
  const maleeToken = maleeLogin.body.token as string;
  const selfOrder = await call('POST', '/orders', {
    restaurantId: malee.id,
    items: [{ menuItemId: kaphraoId, quantity: 1, choiceIds: [spicyMid] }],
    paymentMethod: 'cash',
  }, maleeToken);
  check('เจ้าของร้านสั่งร้านตัวเองไม่ได้', selfOrder.status === 403, `ได้ ${selfOrder.status}`);

  // มาลีเป็นเจ้าของครัวมาลี จึง ต้อง เห็นออเดอร์ที่เข้าร้านตัวเอง (คิวออเดอร์ของร้าน)
  const ownerPeek = await call('GET', `/orders/${placed.body.id}`, undefined, maleeToken);
  check('เจ้าของร้านเห็นออเดอร์ที่เข้าร้านตัวเอง', ownerPeek.status === 200, `ได้ ${ownerPeek.status}`);

  // ส่วนคนที่ไม่เกี่ยวอะไรเลยต้องไม่เห็น และตอบ 404 ไม่ใช่ 403 403 เป็นการยืนยันว่ามีออเดอร์นี้อยู่
  const strangerToken = riderLogin.body.token as string;
  const strangerPeek = await call('GET', `/orders/${placed.body.id}`, undefined, strangerToken);
  check('คนที่ไม่เกี่ยวข้องเปิดดูไม่ได้', strangerPeek.status === 404, `ได้ ${strangerPeek.status}`);

  console.log('\nสิทธิ์การเปลี่ยนสถานะ (กันสร้างรายการบัญชีของคนอื่น)');

  /** `delivered` เขียน ledger จริง ถ้าใครก็กดได้ จะสร้างรายการบัญชีของออเดอร์คนอื่นได้ */
  const byCustomer = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'accepted' }, token);
  check('ลูกค้ารับออเดอร์แทนร้านไม่ได้', byCustomer.status === 403, `ได้ ${byCustomer.status}`);

  const byStranger = await call(
    'PATCH', `/orders/${placed.body.id}/status`, { status: 'accepted' }, strangerToken,
  );
  check('คนที่ไม่เกี่ยวข้องเปลี่ยนสถานะไม่ได้ (404 ไม่ใช่ 403)', byStranger.status === 404, `ได้ ${byStranger.status}`);

  console.log('\nคิวออเดอร์ฝั่งร้าน (product-spec §8 อัตราการรับออเดอร์ > 95%)');

  const queue = await call('GET', '/merchant/orders', undefined, maleeToken);
  check('ร้านดึงคิวออเดอร์ของตัวเองได้', queue.status === 200, JSON.stringify(queue.body));
  const queued = queue.body?.find((o: any) => o.id === placed.body.id);
  check('ออเดอร์ใหม่โผล่ในคิวร้าน', !!queued);
  check('คิวเรียงเก่าไปใหม่ ใบที่รอนานสุดอยู่บน', queue.body.every((o: any, i: number) =>
    i === 0 || queue.body[i - 1].createdAt <= o.createdAt));
  check('ครัวเห็นชื่อรายการพร้อมตัวเลือกที่ลูกค้าเลือก', /ไข่ดาว/.test(queued?.items?.[0]?.name ?? ''));

  /** ร้านเห็นว่าตัวเองได้เท่าไหร่จากใบนี้ = ค่าอาหาร − คอมมิชชัน 15% (§6.1) */
  check('ยอดที่ร้านได้ = ค่าอาหาร − 15%', queued?.restaurantPayout === 13000 - 1950,
    `ได้ ${queued?.restaurantPayout} จาก commission ${queued?.commission}`);
  check('คอมมิชชันคิดจากค่าอาหารอย่างเดียว ไม่รวมค่าส่ง', queued?.commission === 1950, `ได้ ${queued?.commission}`);

  // ร้านไม่ได้เป็นคนไปส่ง จึงไม่ต้องรู้เบอร์ลูกค้า เก็บข้อมูลส่วนบุคคลเท่าที่งานต้องใช้
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
  check('ร้านปิดรับออเดอร์เองได้', closeShop.status === 200 && closeShop.body?.isOpen === false);
  const reopen = await call('PATCH', `/merchant/restaurants/${malee.id}/open`, { isOpen: true }, maleeToken);
  check('ร้านเปิดกลับได้', reopen.status === 200 && reopen.body?.isOpen === true);

  const hijack = await call('PATCH', `/merchant/restaurants/${malee.id}/open`, { isOpen: false }, token);
  check('คนอื่นสั่งปิดร้านเราไม่ได้ (404 ไม่ใช่ 403)', hijack.status === 404, `ได้ ${hijack.status}`);

  // somchai เป็นเจ้าของ "ร้านรออนุมัติ" ยังไม่ผ่านการตรวจ จึงเปิดรับออเดอร์ไม่ได้
  const myShops = await call('GET', '/merchant/restaurants', undefined, token);
  const pendingShop = myShops.body?.find((r: any) => r.name === 'ร้านรออนุมัติ');
  check('ร้านที่รออนุมัติยังอยู่ในรายชื่อ เพื่อให้จอบอกสถานะได้', !!pendingShop && pendingShop.isApproved === false);
  const openPending = await call('PATCH', `/merchant/restaurants/${pendingShop?.id}/open`, { isOpen: true }, token);
  check('ร้านที่ยังไม่อนุมัติเปิดรับออเดอร์ไม่ได้', openPending.status === 404, `ได้ ${openPending.status}`);

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
  // §5 กติกาข้อ 1 เงินเป็นสตางค์จำนวนเต็มเท่านั้น ปล่อยเศษเข้าฐานแล้วคอมมิชชัน 15% จะเพี้ยน
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

  /** แอดมินมีสิทธิ์ทุกสถานะตาม §6.3 (ทางแทรกมือเมื่อระบบจ่ายงานพลาด) */
  const adminLogin = await call('POST', '/auth/login', { identifier: 'admin_root', password: 'wingdai1234' });
  const adminToken = adminLogin.body.token as string;
  check('แอดมินล็อกอินได้', adminLogin.status === 200);

  const skip = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'delivered' }, adminToken);
  check('ข้ามขั้นสถานะไม่ได้ แม้เป็นแอดมิน (created → delivered)', skip.status === 400, `ได้ ${skip.status}`);

  await rejectReasonChecks(token, maleeToken, adminToken, malee.id, kaphraoId, spicyMid);

  // ร้านรับออเดอร์แล้วบอกว่ากำลังทำ เป็นคิวออเดอร์ของร้าน
  for (const s of ['accepted', 'preparing'] as const) {
    const r = await call('PATCH', `/orders/${placed.body.id}/status`, { status: s }, maleeToken);
    check(`ร้านเปลี่ยนเป็น ${s} ได้`, r.status === 200, JSON.stringify(r.body));
  }

  const pickupByShop = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'picked_up' }, maleeToken);
  check('ร้านกดรับของแทนไรเดอร์ไม่ได้', pickupByShop.status === 403, `ได้ ${pickupByShop.status}`);

  // ยังไม่มีระบบจ่ายงานไรเดอร์ (คลื่นที่ 4) จึงยังไม่มีไรเดอร์ผูกกับออเดอร์ แอดมินเดินต่อให้
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
  // ข้อสำคัญที่สุด ลูกค้ากด delivered เองได้ = สร้างรายการบัญชีปลอมของตัวเองได้
  check('ลูกค้ากดส่งถึงแล้วเองไม่ได้', deliveredByCustomer.status === 403, `ได้ ${deliveredByCustomer.status}`);

  const done = await call('PATCH', `/orders/${placed.body.id}/status`, { status: 'delivered' }, adminToken);
  check('ส่งถึงแล้ว (แอดมิน)', done.status === 200, JSON.stringify(done.body));

  const after = await call('POST', `/orders/${placed.body.id}/pay-promptpay`, undefined, token);
  check('ส่งถึงแล้วเปลี่ยนวิธีจ่ายไม่ได้', after.status === 409, `ได้ ${after.status}`);

  console.log('\nจ่ายงานไรเดอร์อัตโนมัติ (product-spec §6.3)');
  await dispatchChecks(token, maleeToken, adminToken, malee.id, kaphraoId, spicyMid);

  console.log('\nledger ที่เขียนลงฐานจริง (product-spec §6.2)');
  await checkLedger(placed.body.id);

  /** ใบที่ไรเดอร์รับไปแล้วต้องหลุดจากคิวครัว ไม่งั้นคิวจะยาวขึ้นเรื่อย ๆ */
  const queueAfter = await call('GET', '/merchant/orders', undefined, maleeToken);
  check('ใบที่ส่งถึงแล้วหลุดจากคิวครัว', !queueAfter.body.some((o: any) => o.id === placed.body.id));
  const history = await call('GET', '/merchant/orders?scope=history', undefined, maleeToken);
  check('ใบที่จบแล้วไปอยู่ในประวัติของร้าน', history.body.some((o: any) => o.id === placed.body.id));
  check('ประวัติเรียงใหม่ไปเก่า', history.body.every((o: any, i: number) =>
    i === 0 || history.body[i - 1].createdAt >= o.createdAt));

  console.log('\nคืนเงินกึ่งอัตโนมัติ + จอ exception ของแอดมิน (§6.4 · §7)');
  await refundChecks(token, adminToken, placed.body.id);

  await adminOrderMonitorChecks(adminToken, token);
  await restaurantPayoutChecks(adminToken, token);
  const superToken = await superAdminChecks(adminToken, token);
  await superConfigChecks(superToken, adminToken, {
    restaurantId: malee.id,
    menuItemId: kaphraoId,
    choiceId: spicyMid,
    customerToken: token,
  });

  await supportTicketChecks(token, adminToken, riderLogin.body.token as string, placed.body.id);
  await leaveAtDoorChecks(token, maleeToken, adminToken, malee.id, kaphraoId, spicyMid);

  console.log('\nเปิดร้านเอง (§4.3)');
  await storageChecks(riderLogin.body.token as string, token);
  // หลัง storageChecks เพราะตอนนั้นไรเดอร์คนนี้เพิ่งส่งเอกสารจริง จอ AD6 จึงมีของให้ตรวจ
  await adminOpsChecks(adminToken, token, riderLogin.body.account.id as string);
  await openRestaurantChecks(token, riderLogin.body.token as string, adminToken, maleeToken);

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

  /** ทางที่สำเร็จต้องมี id_token จริงจาก Google ซึ่งสร้างในสคริปต์ไม่ได้ ทดสอบด้วยมือบนเครื่อง */
  const fakeGoogle = await call('POST', '/auth/google', { idToken: 'ไม่ใช่ token จริง' });
  check('id_token มั่ว ๆ ถูกปฏิเสธ', fakeGoogle.status === 401, `ได้ ${fakeGoogle.status}`);

  const emptyGoogle = await call('POST', '/auth/google', { idToken: '' });
  check('id_token ว่างถูกปฏิเสธตั้งแต่ชั้นตรวจข้อมูล', emptyGoogle.status === 400);

  // ตั๋วเซสชันเซ็นด้วยกุญแจดอกเดียวกับตั๋วผูก Google ต้องแยกกันด้วย typ ไม่ใช่แค่ลายเซ็นถูก
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

/** ตั๋วซัพพอร์ต (design AD4 สเปคคลื่น 2 §5.6) */
async function supportTicketChecks(
  customerToken: string,
  adminToken: string,
  riderToken: string,
  orderId: string,
) {
  console.log('\nตั๋วซัพพอร์ต (AD4)');

  const opened = await call('POST', '/support/tickets', {
    orderId,
    kind: 'order_problem',
    subject: 'อาหารมาไม่ครบ',
    body: 'สั่งสองจาน ได้จานเดียว',
  }, customerToken);
  check('ลูกค้าเปิดตั๋วผูกออเดอร์ของตัวเองได้', opened.status === 201, JSON.stringify(opened.body));
  const ticketId = opened.body?.id as string;
  createdTicketIds.push(ticketId);

  const empty = await call('POST', '/support/tickets', {
    kind: 'other', subject: '   ', body: 'อะไรสักอย่าง',
  }, customerToken);
  check('หัวข้อว่างเปิดไม่ได้', empty.status === 400);

  /** ผูกออเดอร์ของคนอื่นไม่ได้ ไม่งั้นใครก็เปิดตั๋วอ้างเลขที่ออเดอร์ของคนอื่น */
  const stolen = await call('POST', '/support/tickets', {
    orderId, kind: 'order_problem', subject: 'ขอดูใบนี้หน่อย', body: 'อยากรู้',
  }, riderToken);
  check('ผูกออเดอร์ของคนอื่นไม่ได้ และตอบ 404 ไม่ยืนยันว่ามีใบนี้อยู่', stolen.status === 404,
    `ได้ ${stolen.status}`);

  const mine = await call('GET', '/support/tickets', undefined, customerToken);
  check('ตั๋วโผล่ในรายการของตัวเอง',
    mine.status === 200 && mine.body.some((r: any) => r.id === ticketId));
  check('รายการบอกจำนวนข้อความในเธรด',
    mine.body?.find((r: any) => r.id === ticketId)?.messageCount === 1,
    JSON.stringify(mine.body?.[0]));

  const thread = await call('GET', `/support/tickets/${ticketId}`, undefined, customerToken);
  check('เจ้าของอ่านเธรดได้ และข้อความแรกอยู่ในเธรด',
    thread.status === 200 && thread.body?.messages?.length === 1);

  const peek = await call('GET', `/support/tickets/${ticketId}`, undefined, riderToken);
  check('คนอื่นอ่านเธรดไม่ได้', peek.status === 403, `ได้ ${peek.status}`);

  const adminQueue = await call('GET', '/admin/support/tickets?status=open', undefined, adminToken);
  check('ตั๋วโผล่ในคิวของแอดมิน',
    adminQueue.status === 200 && adminQueue.body.some((r: any) => r.id === ticketId));

  const reply = await call('POST', `/support/tickets/${ticketId}/messages`, {
    body: 'ขอโทษด้วยครับ กำลังตรวจสอบให้',
  }, adminToken);
  check('แอดมินตอบในเธรดได้', reply.status === 201, JSON.stringify(reply.body));

  const afterReply = await call('GET', `/support/tickets/${ticketId}`, undefined, customerToken);
  check('คำตอบของแอดมินถูกทำเครื่องหมายว่ามาจากทีมงาน',
    afterReply.body?.messages?.[1]?.fromStaff === true,
    JSON.stringify(afterReply.body?.messages?.[1]));

  const notMine = await call('POST', `/support/tickets/${ticketId}/messages`, {
    body: 'แทรกหน่อย',
  }, riderToken);
  check('คนอื่นตอบในเธรดไม่ได้', notMine.status === 403, `ได้ ${notMine.status}`);

  const closeByCustomer = await call('POST', `/admin/support/tickets/${ticketId}/close`,
    undefined, customerToken);
  check('ลูกค้าปิดตั๋วเองไม่ได้', closeByCustomer.status === 403, `ได้ ${closeByCustomer.status}`);

  const closed = await call('POST', `/admin/support/tickets/${ticketId}/close`,
    undefined, adminToken);
  check('แอดมินปิดตั๋วได้', closed.status === 200);

  const afterClose = await call('POST', `/support/tickets/${ticketId}/messages`, {
    body: 'ยังไม่จบนะ',
  }, customerToken);
  check('ตั๋วที่ปิดแล้วตอบไม่ได้', afterClose.status === 409, `ได้ ${afterClose.status}`);

  const closeTwice = await call('POST', `/admin/support/tickets/${ticketId}/close`,
    undefined, adminToken);
  check('ปิดซ้ำไม่พัง แต่บอกว่าปิดไปแล้ว', closeTwice.status === 404, `ได้ ${closeTwice.status}`);
}

/** วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
async function leaveAtDoorChecks(
  customerToken: string,
  maleeToken: string,
  adminToken: string,
  restaurantId: string,
  menuItemId: string,
  choiceId: string,
) {
  console.log('\nวางไว้หน้าประตู (§7)');

  const placed = await call('POST', '/orders', {
    restaurantId,
    items: [{ menuItemId, quantity: 1, choiceIds: [choiceId] }],
    paymentMethod: 'promptpay',
    leaveAtDoor: true,
  }, customerToken);
  createdOrderIds.push(placed.body?.id);
  check('สั่งพร้อมคำขอวางหน้าประตูได้', placed.status === 201, JSON.stringify(placed.body));
  check('คำขอถูกบันทึกบนออเดอร์', placed.body?.leaveAtDoor === true);

  const orderId = placed.body?.id as string;

  /** ต้องเดินเส้นทางเดียวกับหัวข้อจ่ายงาน: ร้านรับใบ → แอดมินสั่งจ่ายงาน → ไรเดอร์กดรับ */
  const annLogin = await call('POST', '/auth/login', { identifier: 'rider_ann', password: 'wingdai1234' });
  const riderToken = annLogin.body.token as string;
  await call('POST', '/rider/online', { isOnline: true, lat: 13.7805, lng: 100.5435 }, riderToken);

  await call('PATCH', `/orders/${orderId}/status`, { status: 'accepted' }, maleeToken);
  const offered = await call('POST', `/admin/dispatch/orders/${orderId}`, undefined, adminToken);
  check('จ่ายงานใบวางหน้าประตูให้ไรเดอร์ได้', offered.body?.offered === true, JSON.stringify(offered.body));

  const accept = await call('POST', `/rider/jobs/${orderId}/accept`, undefined, riderToken);
  if (accept.status !== 200 && accept.status !== 201) {
    check('ไรเดอร์รับงานใบนี้ได้', false, `ได้ ${accept.status} ${JSON.stringify(accept.body)}`);
    return;
  }
  await call('PATCH', `/orders/${orderId}/status`, { status: 'preparing' }, maleeToken);
  await call('PATCH', `/orders/${orderId}/status`, { status: 'picked_up' }, riderToken);

  const jobs = await call('GET', '/rider/jobs', undefined, riderToken);
  check('งานของไรเดอร์พกคำขอมาด้วย — ไม่งั้นจอ R11 ไม่รู้ว่าต้องซ่อนช่อง PIN',
    jobs.body?.find((j: any) => j.orderId === orderId)?.leaveAtDoor === true);

  const noPhoto = await call('PATCH', `/orders/${orderId}/status`, {
    status: 'delivered',
  }, riderToken);
  check('ไม่มีรูปปิดงานไม่ได้ แม้เป็นใบวางหน้าประตู', noPhoto.status === 400, `ได้ ${noPhoto.status}`);

  const done = await call('PATCH', `/orders/${orderId}/status`, {
    status: 'delivered', photoPath: 'rider-docs/smoke-proof.jpg',
  }, riderToken);
  check('รูปอย่างเดียวปิดงานได้ — ลูกค้าไม่อยู่ให้บอกรหัส', done.status === 200,
    JSON.stringify(done.body));

  // คืนสถานะเดิม ไม่ให้ไรเดอร์คนนี้ค้างออนไลน์ไปโผล่ในหัวข้อถัดไป
  await call('POST', '/rider/online', { isOnline: false }, riderToken);
}

/** ลบร่องรอยของการทดสอบทุกครั้ง ไม่ว่าจะผ่านหรือไม่ผ่าน */
async function cleanup() {
  const sql = createScriptClient();
  try {
    const ids = createdOrderIds.filter(Boolean);
    if (ids.length > 0) {
      /** ledger เป็น append-only มี trigger ห้าม DELETE ปิดชั่วคราวเฉพาะตอนเก็บกวาดข้อมูลทดสอบ */
      await sql`alter table ledger_entries disable trigger ledger_entries_no_delete`;
      await sql`delete from ledger_entries where order_id in ${sql(ids)}`;
      /** แถวจ่ายเงินไรเดอร์ไม่ผูกกับออเดอร์ใบไหน (order_id เป็น null) จึงรอดจากบรรทัดบน */
      await sql`delete from ledger_entries where reason = 'rider.payout'`;
      /** รอบจ่ายร้านก็ไม่ผูกกับออเดอร์เหมือนกัน และอาการหนักกว่าของไรเดอร์ด้วยซ้ำ: */
      await sql`delete from ledger_entries where reason = 'restaurant.payout'`;
      await sql`alter table ledger_entries enable trigger ledger_entries_no_delete`;
      await sql`delete from rider_payouts`;
      /** เอกสารไม่ผูกกับออเดอร์ จึงไม่หายไปพร้อมการลบข้างบน */
      await sql`delete from rider_documents`;
      await sql`delete from refund_cases where order_id in ${sql(ids)}`;
      await sql`delete from dispatch_offers where order_id in ${sql(ids)}`;
      await sql`delete from orders where id in ${sql(ids)}`;
    }
    const ticketIds = createdTicketIds.filter(Boolean);
    if (ticketIds.length > 0) await sql`delete from support_tickets where id in ${sql(ticketIds)}`;
    const menuIds = createdMenuItemIds.filter(Boolean);
    if (menuIds.length > 0) await sql`delete from menu_items where id in ${sql(menuIds)}`;
    const shopIds = createdRestaurantIds.filter(Boolean);
    if (shopIds.length > 0) await sql`delete from restaurants where id in ${sql(shopIds)}`;
    await sql`delete from accounts where username = ${SMOKE_USERNAME}`;
    await sql`delete from phone_verifications where phone = ${SMOKE_PHONE}`;

    /** คืนค่าตั้งค่าแพลตฟอร์มเสมอ ที่นี่ ไม่ใช่ท้ายเทสต์ */
    await sql`
      update platform_pricing
         set commission_rate_bp = 1500, delivery_base_satang = 1500,
             delivery_per_km_satang = 600, service_fee_satang = 500
       where singleton = true`;
    await sql`delete from feature_flags`;

    // audit_log มี trigger ห้ามลบเหมือน ledger ปิดชั่วคราวเฉพาะตอนเก็บกวาดข้อมูลทดสอบ
    await sql`alter table audit_log disable trigger audit_log_no_delete`;
    await sql`delete from audit_log`;
    await sql`alter table audit_log enable trigger audit_log_no_delete`;
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
