import { createHttpRepos, ApiError } from '../src/data/http';
import { createMemoryTokenStore } from '../src/data/http/tokenStore';
import type { Account, WeeklyHours } from '../src/data/types';

/** ยิงโค้ดฝั่งแอปของจริงไปหา core-api ที่รันอยู่จริง */
const BASE_URL = process.env.EXPO_PUBLIC_WINGDAI_API_URL ?? 'http://localhost:3000/api';

/** ต้องตรงกับ SEED_PASSWORD ใน services/core-api/src/db/seed.ts */
const SEED_PASSWORD = 'wingdai1234';

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

async function mustReject(label: string, body: () => Promise<unknown>) {
  try {
    await body();
    check(label, false, 'ไม่ถูกปฏิเสธ');
  } catch {
    check(label, true);
  }
}

/** ถูกปฏิเสธ ด้วยรหัสที่ระบุ ใช้เมื่อทางที่สำเร็จเดินจริงไม่ได้ (ย้อนคืนไม่ได้ หรือขยับเงิน) */
async function mustRejectWith(label: string, status: number, body: () => Promise<unknown>) {
  try {
    await body();
    check(label, false, 'ไม่ถูกปฏิเสธ');
  } catch (error) {
    const got = error instanceof ApiError ? error.status : undefined;
    check(label, got === status, `คาด ${status} ได้ ${got ?? error}`);
  }
}

const store = createMemoryTokenStore();
const repos = createHttpRepos(BASE_URL, store);

/** ตารางเวลาเปิด-ปิดและการพัก (design M11) เรียกตอนล็อกอินเป็นเจ้าของร้านแล้ว */
async function storeHoursChecks(restaurantId: string) {
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const openAllWeek = Object.fromEntries(
    DAYS.map((d) => [d, { open: '00:00', close: '23:59' }]),
  ) as WeeklyHours;
  const closedAllWeek = Object.fromEntries(DAYS.map((d) => [d, null])) as WeeklyHours;

  const closed = await repos.merchant.setHours(restaurantId, closedAllWeek);
  check('ตั้งตารางเวลาผ่านรีโปจริงได้', Object.keys(closed.openingHours).length === 7);
  check('ปิดทุกวัน = ร้านไม่รับออร์เดอร์', closed.isAcceptingOrders === false);

  const seenByCustomer = await repos.catalog.getRestaurant(restaurantId);
  check('ฝั่งลูกค้าเห็นว่าปิดตรงกัน', seenByCustomer?.isOpen === false);

  await mustRejectWith('เวลาเปิดเท่ากับเวลาปิด ตั้งไม่ได้', 400, () =>
    repos.merchant.setHours(restaurantId, { ...openAllWeek, mon: { open: '09:00', close: '09:00' } }),
  );

  const reopened = await repos.merchant.setHours(restaurantId, openAllWeek);
  check('เปิดทั้งสัปดาห์แล้วกลับมารับออร์เดอร์', reopened.isAcceptingOrders === true);

  await mustRejectWith('พักนานเกินเพดาน ทำไม่ได้', 400, () =>
    repos.merchant.pause(restaurantId, 240),
  );

  const paused = await repos.merchant.pause(restaurantId, 15);
  check('พักรับออร์เดอร์ได้', paused.isAcceptingOrders === false && paused.pausedUntil !== null);
  // การพักต้องไม่ปิดสวิตช์ ไม่งั้นครบเวลาแล้วร้านจะไม่กลับมาเอง
  check('พักแล้วสวิตช์ร้านยังเปิดอยู่', paused.isOpen === true);

  const resumed = await repos.merchant.pause(restaurantId, 0);
  check('กลับมารับออร์เดอร์ได้', resumed.pausedUntil === null && resumed.isAcceptingOrders === true);
}

async function main() {
  console.log(`\nเซิร์ฟเวอร์ ${BASE_URL}`);

  console.log('\nเข้าสู่ระบบ');

  const account = await repos.auth.login('somchai', SEED_PASSWORD);
  check('ล็อกอินด้วย username ได้', account.username === 'somchai');
  check('เก็บ token ไว้ใช้ต่อ', !!store.get());
  check('ไม่มี password hash ติดมาในคำตอบ', !JSON.stringify(account).includes('argon2'));

  const restored = await repos.auth.restore();
  check('เปิดแอปใหม่แล้วยังล็อกอินอยู่ (restore)', restored?.username === 'somchai');

  await store.clear();
  const byPhone = await repos.auth.login('0812345678', SEED_PASSWORD);
  // product-spec §4.2 เบอร์โทรเป็น identifier ได้เหมือน username
  check('ล็อกอินด้วยเบอร์โทรได้บัญชีเดียวกัน', byPhone.id === account.id);

  await mustReject('รหัสผิดถูกปฏิเสธ', () => repos.auth.login('somchai', 'ผิดแน่นอน1234'));
  await mustReject('อีเมลใช้ล็อกอินไม่ได้', () =>
    repos.auth.login('somchai@wingdai.test', SEED_PASSWORD),
  );

  await store.clear();
  check('ไม่มี token → restore คืน null ไม่ใช่โยน error', (await repos.auth.restore()) === null);

  console.log('\nร้านและเมนู');

  const anon = await repos.catalog.listRestaurants();
  check('ยังไม่ล็อกอินก็ดูร้านได้', anon.length > 0);
  check('ไม่รู้ว่าอยู่ไหน ระยะทางเป็น null ไม่ใช่เลขมั่ว', anon.every((r) => r.distanceKm === null));
  check('ยังไม่มีระบบรีวิว คะแนนจึงเป็น null ไม่ใช่ ★ ปลอม', anon.every((r) => r.rating === null));
  check('ร้านที่ยังไม่อนุมัติไม่โผล่', !anon.some((r) => r.name === 'ร้านรออนุมัติ'));

  await repos.auth.login('somchai', SEED_PASSWORD);
  const list = await repos.catalog.listRestaurants();
  const malee = list.find((r) => r.name === 'ครัวมาลี')!;
  check('ล็อกอินแล้วได้ระยะทางจากที่อยู่ตัวเอง', malee?.distanceKm === 0.2, `ได้ ${malee?.distanceKm}`);
  /** numeric ของ Postgres ถูกส่งกลับมาเป็น "สตริง" ถ้าไม่ cast เป็น float8 */
  check('ระยะทางเป็น number ไม่ใช่สตริง', typeof malee?.distanceKm === 'number');

  const found = await repos.catalog.searchRestaurants('กะเพรา');
  check('ค้นด้วยชื่อเมนูเจอร้านที่ขาย (design C2)', found.some((r) => r.name === 'ครัวมาลี'));

  const menu = await repos.catalog.getMenu(malee.id);
  const kaphrao = menu.find((m) => m.name === 'ข้าวกะเพราหมูสับ')!;
  check('ราคาเป็นสตางค์จำนวนเต็ม', Number.isInteger(kaphrao?.price) && kaphrao.price === 5000);
  check('กลุ่มตัวเลือกติดมาด้วย', kaphrao?.optionGroups?.length === 2);
  check('ของหมดยังอยู่ในเมนู ให้จอขึ้นป้ายได้', menu.some((m) => !m.isAvailable));

  const missing = await repos.catalog.getRestaurant('00000000-0000-4000-8000-000000000000');
  check('ร้านที่ไม่มีอยู่คืน null ไม่ใช่โยน error', missing === null);

  console.log('\nสั่งอาหาร — เซิร์ฟเวอร์คิดเงิน');

  const spicy = kaphrao.optionGroups![0]!.choices[1]!.id; // เผ็ดกลาง +0
  const egg = kaphrao.optionGroups![1]!.choices[0]!.id; // ไข่ดาว +฿15

  const order = await repos.orders.create({
    restaurantId: malee.id,
    items: [{ menuItemId: kaphrao.id, quantity: 2, choiceIds: [spicy, egg] }],
    paymentMethod: 'cash',
  });

  // ข้าวกะเพรา ฿50 + ไข่ดาว ฿15 = ฿65 ต่อจาน × 2 = ฿130
  check('ราคาต่อหน่วยรวมตัวเลือกที่เลือก', order.items[0]?.unitPrice === 6500, `ได้ ${order.items[0]?.unitPrice}`);
  check('ค่าอาหารคิดจากเมนูในฐาน', order.foodTotal === 13000, `ได้ ${order.foodTotal}`);
  check('ค่าส่งกับค่าบริการแยกบรรทัด', order.deliveryFee === 1500 && order.serviceFee === 500);
  check('เลขที่ออร์เดอร์อ่านออก ไม่ใช่ uuid', /^WD-[23456789A-HJ-NP-Z]{6}$/.test(order.reference));
  check('สั่งเงินสด = ยังไม่จ่าย', order.paymentStatus === 'pending');

  const paid = await repos.orders.payWithPromptPay(order.id);
  // product-spec §6.5 เงินสดไม่พอแล้วจ่ายพร้อมเพย์แทน ไรเดอร์ไม่ต้องออกเงิน
  check('เปลี่ยนไปจ่ายพร้อมเพย์ได้', paid.paymentMethod === 'promptpay' && paid.paymentStatus === 'paid');
  await mustReject('กดจ่ายซ้ำไม่ได้', () => repos.orders.payWithPromptPay(order.id));

  const reread = await repos.orders.get(order.id);
  check('อ่านซ้ำแล้วยังจ่ายแล้ว', reread?.paymentStatus === 'paid');

  const mine = await repos.orders.listForCustomer(account.id);
  check('ออร์เดอร์อยู่ในประวัติของตัวเอง', mine.some((o) => o.id === order.id));

  /** การกด delivered เขียน ledger จริง ลูกค้าทำเองได้เท่ากับสร้างรายการบัญชีปลอม */
  await mustReject('ลูกค้ากดส่งถึงแล้วเองไม่ได้', () =>
    repos.orders.updateStatus(order.id, 'delivered'),
  );
  await mustReject('ลูกค้ารับออร์เดอร์แทนร้านไม่ได้', () =>
    repos.orders.updateStatus(order.id, 'accepted'),
  );

  console.log('\nฝั่งร้าน — คิวออร์เดอร์');

  // สมชายเป็นเจ้าของ "ร้านรออนุมัติ" ที่ยังไม่ผ่านการตรวจ
  const myShops = await repos.merchant.myRestaurants();
  const pendingShop = myShops.find((s) => s.name === 'ร้านรออนุมัติ');
  check('ดึงร้านของตัวเองได้', !!pendingShop);
  check('ร้านที่รออนุมัติบอกสถานะได้ ไม่ใช่ซ่อนหาย', pendingShop?.isApproved === false);
  await mustReject('ร้านที่ยังไม่อนุมัติเปิดรับออร์เดอร์ไม่ได้', () =>
    repos.merchant.setOpen(pendingShop!.id, true),
  );
  check('ไม่มีคิวของร้านคนอื่นหลุดมา', (await repos.merchant.listOrders()).length === 0);

  await repos.auth.login('malee', SEED_PASSWORD);
  const queue = await repos.merchant.listOrders({ scope: 'queue' });
  const mineInQueue = queue.find((o) => o.id === order.id);
  check('เจ้าของร้านเห็นออร์เดอร์ที่เข้าร้านตัวเอง', !!mineInQueue);
  // ข้าวกะเพรา ฿50 + ไข่ดาว ฿15 = ฿65 × 2 = ฿130 → หัก 15% = ฿19.50 → ร้านได้ ฿110.50
  check('ยอดที่ร้านได้ = ค่าอาหาร − 15%', mineInQueue?.restaurantPayout === 11050, `ได้ ${mineInQueue?.restaurantPayout}`);
  check('ไม่มีเบอร์โทรลูกค้าติดมากับคิวร้าน', !JSON.stringify(queue).includes('081'));

  const opened = await repos.merchant.setOpen(mineInQueue!.restaurantId, false);
  check('ร้านปิดรับออร์เดอร์เองได้', opened.isOpen === false);
  await repos.merchant.setOpen(mineInQueue!.restaurantId, true);

  await storeHoursChecks(mineInQueue!.restaurantId);

  const menu2 = await repos.catalog.getMenu(mineInQueue!.restaurantId);
  const target = menu2.find((m) => m.isAvailable)!;
  const soldOut = await repos.merchant.updateMenuItem(target.id, { isAvailable: false });
  check('ร้านกดของหมดได้', soldOut.isAvailable === false);
  await repos.merchant.updateMenuItem(target.id, { isAvailable: true });

  // ร้านรับออร์เดอร์แล้วบอกว่ากำลังทำ สิทธิ์ที่ authorize.ts ให้ร้านทำได้
  check('ร้านรับออร์เดอร์ได้', (await repos.orders.updateStatus(order.id, 'accepted')).status === 'accepted');
  await mustReject('ร้านกดรับของแทนไรเดอร์ไม่ได้', () =>
    repos.orders.updateStatus(order.id, 'picked_up'),
  );

  console.log('\nยอดขายของร้าน (M1 · M5)');

  const summary = await repos.merchant.summary();
  check('ใบที่เพิ่งรับไปนับอยู่ในคิวที่ต้องทำ', summary.openQueue >= 1, `ได้ ${summary.openQueue}`);
  check(
    'ยอดที่ร้านได้ = ค่าอาหาร − คอมมิชชัน ทุกช่วงเวลา',
    summary.today.netSatang === summary.today.foodSalesSatang - summary.today.commissionSatang
      && summary.last7Days.netSatang
         === summary.last7Days.foodSalesSatang - summary.last7Days.commissionSatang,
  );
  check(
    'ทุกยอดเป็นจำนวนเต็มสตางค์ ไม่มีทศนิยมหลุดมา',
    [
      summary.today.foodSalesSatang, summary.today.commissionSatang, summary.today.netSatang,
      summary.last7Days.foodSalesSatang, summary.last7Days.netSatang,
    ].every(Number.isInteger),
  );
  check('ยอดวันนี้ไม่เกินยอด 7 วัน', summary.today.orders <= summary.last7Days.orders);

  await repos.auth.login('somchai', SEED_PASSWORD);

  console.log('\nที่อยู่จัดส่ง');

  const addresses = await repos.addresses.list();
  check('ดึงที่อยู่ของตัวเองได้', addresses.length > 0);
  check(
    'ที่อยู่มีพิกัดเป็นตัวเลข',
    typeof addresses[0]?.lat === 'number' && typeof addresses[0]?.lng === 'number',
  );

  console.log('\nรายได้ไรเดอร์ (R4 · R6)');

  await repos.auth.login('rider_ann', SEED_PASSWORD);
  const earnings = await repos.rider.earnings();
  check(
    'ยอดรวมเท่ากับผลบวกค่าส่งของทุกงานในรายการ',
    earnings.totalPaySatang === earnings.deliveries.reduce((s, d) => s + d.riderPaySatang, 0),
  );
  check('ทุกยอดค่าส่งเป็นจำนวนเต็มสตางค์', earnings.deliveries.every((d) => Number.isInteger(d.riderPaySatang)));
  /** §8 null แปลว่า "ยังวัดไม่ได้" ส่วน 0 แปลว่า "ออนไลน์แล้วแต่ยังไม่ได้ส่งงาน" */
  check(
    'งาน/ชั่วโมงเป็น null ก็ต่อเมื่อยังไม่เคยออนไลน์',
    earnings.hours === 0
      ? earnings.ordersPerHour === null
      : typeof earnings.ordersPerHour === 'number',
    `ชั่วโมง ${earnings.hours} · ได้ ${earnings.ordersPerHour}`,
  );
  check(
    'ประวัติเรียงใหม่ไปเก่า',
    earnings.deliveries.every((d, i) => i === 0 || d.deliveredAt <= earnings.deliveries[i - 1]!.deliveredAt),
  );

  console.log('\nไรเดอร์ — สถานะ จุดตั้งทำงาน เอกสาร (R2 · R7 · R8)');

  const riderStatus = await repos.rider.status();
  check('ไรเดอร์ที่อนุมัติแล้วเห็นสถานะตัวเอง', riderStatus.approval === 'approved');
  check('ยอดเงินสดในมือกับเพดานเป็นจำนวนเต็มสตางค์',
    Number.isInteger(riderStatus.cashHeldSatang) && Number.isInteger(riderStatus.cashLimitSatang));
  check('งานที่กำลังทำอยู่ตอบเป็นรายการเสมอ', Array.isArray(riderStatus.activeJobs));

  // ไม่รู้ว่าอยู่ไหน = ให้คะแนนระยะทางไม่ได้ = จ่ายงานให้ไม่ได้ จึงต้องบังคับตั้งแต่เปิดรับงาน
  await mustRejectWith('เปิดรับงานโดยไม่ส่งพิกัดไม่ได้', 409, () => repos.rider.setOnline(true));

  const online = await repos.rider.setOnline(true, { lat: 13.7805, lng: 100.5435 });
  check('เปิดรับงานพร้อมพิกัดได้', online.isOnline === true);
  // §8 ตัวหารของ Orders per Rider Hour ไม่บันทึกเวลาเริ่ม ก็คิดตัวชี้วัดหลักไม่ได้เลย
  check('บันทึกเวลาที่เริ่มออนไลน์', !!online.onlineSince);

  await repos.rider.ping(13.7810, 100.5440);
  const afterPing = await repos.rider.status();
  check('ส่งพิกัดระหว่างทางแล้วตำแหน่งล่าสุดขยับตาม',
    afterPing.lastLocation?.lat === 13.781, JSON.stringify(afterPing.lastLocation));

  const baseBefore = await repos.rider.workBase();
  await mustRejectWith('รัศมีเกิน 20 กม. ถูกปฏิเสธ', 400, () =>
    repos.rider.setWorkBase({ lat: 13.7805, lng: 100.5435, radiusKm: 21 }),
  );
  await mustRejectWith('รัศมีต่ำกว่า 1 กม. ถูกปฏิเสธ', 400, () =>
    repos.rider.setWorkBase({ lat: 13.7805, lng: 100.5435, radiusKm: 0 }),
  );
  const base = await repos.rider.setWorkBase({ lat: 13.7805, lng: 100.5435, radiusKm: 20 });
  check('ปักหมุดจุดตั้งทำงานได้', base?.radiusKm === 20, JSON.stringify(base));
  /** ตั้งรัศมีกว้างสุดไว้เสมอ ไม่ใช่คืนค่าเดิม เพราะ ไม่มีเส้นทางล้างหมุดกลับเป็น null */
  check('จุดตั้งทำงานเดิมอ่านได้ (null = ยังไม่เคยปัก)',
    baseBefore === null || typeof baseBefore.radiusKm === 'number');

  const riderDocs = await repos.rider.documents();
  check('R8 คืนครบหกชนิดเสมอ แม้ยังไม่ส่ง', riderDocs.length === 6, `ได้ ${riderDocs.length}`);
  check('ชนิดที่ยังไม่ส่งเป็น missing ไม่ใช่หายไปจากรายการ',
    riderDocs.every((d) => ['missing', 'reviewing', 'verified', 'rejected'].includes(d.status)));

  // ไฟล์เล็กสุดที่เป็นรูปจริง ทดสอบครบสามขั้น ขอลิงก์ → อัปโหลด → บันทึกเส้นทาง
  const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
    + 'AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const uploadedDoc = await repos.rider.uploadDocument('selfie', { uri: PIXEL, ext: 'png' });
  // อัปแล้วต้องเป็น "รอตรวจ" ไม่ใช่ "ผ่าน" ไม่งั้นไรเดอร์อนุมัติเอกสารตัวเองได้
  check('อัปเอกสารแล้วเข้าสถานะรอตรวจ ไม่ใช่ผ่านทันที',
    uploadedDoc.status === 'reviewing', JSON.stringify(uploadedDoc));
  check('มีเวลาที่อัปติดมาด้วย', !!uploadedDoc.uploadedAt);

  const stats = await repos.rider.stats();
  check('ตัวเลขงานเป็นจำนวนเต็ม', Number.isInteger(stats.delivered));
  check('งาน/ชั่วโมงเป็น null ก็ต่อเมื่อยังไม่เคยออนไลน์',
    stats.hours === 0 ? stats.ordersPerHour === null : typeof stats.ordersPerHour === 'number',
    `ชั่วโมง ${stats.hours} · ได้ ${stats.ordersPerHour}`);

  const balance = await repos.rider.balance();
  /** §6.2 เงินสดที่ไรเดอร์เก็บมาเป็นเงินของบริษัท หักออกจากยอดถอนเสมอ */
  check('ยอดถอน = รายได้ค้างจ่าย − เงินสดในมือ เป๊ะ ๆ ไม่ปัดขึ้นศูนย์',
    balance.withdrawableSatang === balance.payableSatang - balance.cashHeldSatang,
    JSON.stringify(balance));
  check('ทุกยอดเป็นจำนวนเต็มสตางค์',
    [balance.payableSatang, balance.cashHeldSatang, balance.withdrawableSatang]
      .every(Number.isInteger));
  await mustRejectWith('ขอถอนเกินยอดที่มีไม่ได้', 400, () =>
    repos.rider.requestPayout(balance.withdrawableSatang + 100_000_00),
  );
  await mustRejectWith('ขอถอนยอดติดลบไม่ได้', 400, () => repos.rider.requestPayout(-100));

  /** ขอถอนจริงไว้ให้ขั้นแอดมินข้างล่างได้ตัดสินของจริง แล้วที่นั่นจะปฏิเสธ ซึ่งไม่เขียน ledger */
  if (!balance.pending && balance.withdrawableSatang > 0) {
    const requested = await repos.rider.requestPayout(balance.withdrawableSatang);
    check('ขอถอนตามยอดที่มีได้', requested.status === 'requested', JSON.stringify(requested));
    await mustRejectWith('มีคำขอค้างอยู่แล้ว ขอซ้ำไม่ได้', 409, () =>
      repos.rider.requestPayout(1),
    );
  } else {
    check(
      balance.pending
        ? 'มีคำขอถอนค้างอยู่แล้วจากรอบก่อน — ใช้ใบนั้นทดสอบขั้นแอดมิน'
        : 'ยอดสุทธิยังไม่เป็นบวก (เงินสดในมือหักอยู่) — ขอถอนไม่ได้ ซึ่งถูกแล้วตาม §6.2',
      true,
    );
  }

  console.log('\nไรเดอร์ — รับงาน แจ้งปัญหา รูปยืนยันส่ง (R3 · R9 · R11)');

  await repos.auth.login('admin_root', SEED_PASSWORD);
  const offered = await repos.admin.forceDispatch(order.id);
  check('แอดมินสั่งจ่ายงานมือได้ (§6.3 ทางแทรกมือ)', offered.offered === true,
    JSON.stringify(offered));

  await repos.auth.login('rider_ann', SEED_PASSWORD);
  const withOffer = await repos.rider.status();
  check('ไรเดอร์เห็นงานที่ถูกเสนอ', withOffer.offer?.orderId === order.id,
    JSON.stringify(withOffer.offer));
  check('ข้อเสนอมีเวลาหมดอายุ ไม่ใช่ค้างไว้ตลอด', !!withOffer.offer?.expiresAt);
  // §6.5 ค่าตอบแทนไรเดอร์คือค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่ายทั้งใบ
  check('ค่าตอบแทนที่เสนอ = ค่าส่งของใบนั้น',
    withOffer.offer?.riderPaySatang === order.deliveryFee,
    `เสนอ ${withOffer.offer?.riderPaySatang} · ค่าส่ง ${order.deliveryFee}`);

  const job = await repos.rider.acceptOffer(order.id);
  check('กดรับงานได้', job.orderId === order.id);
  check('งานที่รับมาพกทั้งที่อยู่ร้านและที่อยู่ลูกค้า',
    !!job.restaurantAddress && !!job.restaurantLat);
  check('งานโผล่ในรายการงานของตัวเอง',
    (await repos.rider.jobs()).some((j) => j.orderId === order.id));
  await mustRejectWith('กดรับซ้ำไม่ได้', 409, () => repos.rider.acceptOffer(order.id));
  await mustRejectWith('ปฏิเสธงานที่ไม่มีข้อเสนออยู่ไม่ได้', 404, () =>
    repos.rider.declineOffer('00000000-0000-4000-8000-000000000000'),
  );

  const photoPath = await repos.rider.uploadDeliveryPhoto(order.id, { uri: PIXEL, ext: 'png' });
  // รูปต้องขึ้นบักเก็ตปิดก่อนปิดงาน ปิดงานสำเร็จแล้วรูปพังทีหลัง = หลักฐานหายทั้งที่ระบบบอกว่ามี
  check('อัปรูปยืนยันส่งได้ และคืนเส้นทางในบักเก็ตมา', photoPath.length > 0, photoPath);

  await repos.rider.reportIssue({
    orderId: order.id, kind: 'cannot_reach_customer', detail: 'ทดสอบจากสคริปต์ตรวจแอป',
  });
  const stillRunning = await repos.orders.get(order.id);
  // R9 เรื่องที่ไรเดอร์แจ้งเข้าคิวให้แอดมินตัดสิน ไม่เปลี่ยนสถานะออร์เดอร์เอง
  check('แจ้งปัญหาแล้วออร์เดอร์ไม่ถูกยกเลิกเอง', stillRunning?.status !== 'cancelled',
    `ได้ ${stillRunning?.status}`);

  await repos.auth.login('admin_root', SEED_PASSWORD);
  const issueRow = (await repos.admin.exceptions())
    .find((e) => e.orderId === order.id && e.kind === 'rider_issue');
  check('เรื่องที่แจ้งไปโผล่ในคิวข้อยกเว้นของแอดมิน', !!issueRow, JSON.stringify(issueRow));
  if (issueRow?.riderIssueId) {
    await repos.admin.resolveRiderIssue(issueRow.riderIssueId);
    check('แอดมินเคลียร์เรื่องแล้วหลุดจากคิว',
      !(await repos.admin.exceptions())
        .some((e) => e.orderId === order.id && e.kind === 'rider_issue'));
  }

  await repos.auth.login('somchai', SEED_PASSWORD);

  console.log('\nแก้โปรไฟล์ (C21)');

  const before = (await repos.auth.restore())!;
  const renamed = await repos.auth.updateProfile({ fullName: 'สมชาย ใจกล้า', email: null });
  check('แก้ชื่อได้', renamed.fullName === 'สมชาย ใจกล้า');
  check('ลบอีเมลออกได้', !renamed.email);
  // §4.2 เบอร์ผ่าน OTP แล้วและ username เป็น identifier ที่ใช้ล็อกอิน เส้นทางนี้ต้องแตะไม่ได้
  check('เบอร์ไม่ถูกแก้ตามไปด้วย', renamed.phone === before.phone);
  check('ชื่อผู้ใช้ไม่ถูกแก้ตามไปด้วย', renamed.username === before.username);
  await mustReject('ชื่อว่างถูกปฏิเสธ', () =>
    repos.auth.updateProfile({ fullName: '   ', email: null }),
  );
  await repos.auth.updateProfile({ fullName: before.fullName, email: before.email ?? null });

  console.log('\nใบสมัครไรเดอร์ (R5)');

  await repos.auth.login('rider_ann', SEED_PASSWORD);
  const zones = await repos.rider.zones();
  check('มีโซนที่เปิดให้บริการอย่างน้อยหนึ่งโซน', zones.length >= 1, `ได้ ${zones.length}`);
  const app = await repos.rider.application();
  check('ไรเดอร์ที่อนุมัติแล้วมีใบสมัครอยู่จริง', app.status === 'approved', `ได้ ${app.status}`);
  // §7 ข้อมูลที่แอดมินตรวจแล้ว ไรเดอร์แก้เองทีหลังไม่ได้ ไม่งั้นเท่ากับล้างการตรวจทิ้ง
  await mustReject('ไรเดอร์ที่อนุมัติแล้วแก้ใบสมัครเองไม่ได้', () =>
    repos.rider.submitApplication({
      nationalId: '1101700635799', dateOfBirth: '2000-01-31',
      vehicleRegistration: '1กข 1234', licenceExpiry: '2030-12-31',
      compulsoryInsuranceExpiry: '2030-06-30',
      bankName: 'กสิกรไทย', bankAccountNumber: '1234567890', bankAccountName: 'แอน ใจดี',
      emergencyContactName: 'สมหญิง', emergencyContactPhone: '0898887777',
      acceptContract: true, acceptPdpa: true,
    }),
  );

  await repos.auth.login('admin_root', SEED_PASSWORD);
  const riderQueue = await repos.admin.pendingRiders();
  check(
    'คิวอนุมัติไรเดอร์ตอบเป็นรายการได้ และมีธงเช็คชื่อบัญชีทุกใบ',
    Array.isArray(riderQueue) && riderQueue.every((x) => typeof x.bankNameMatches === 'boolean'),
  );
  check(
    'ไม่มีใบที่อนุมัติแล้วหลุดมาอยู่ในคิวรอตรวจ',
    !riderQueue.some((x) => x.phone === '0899999999'),
  );
  await repos.auth.login('somchai', SEED_PASSWORD);
  await mustReject('บัญชีที่ไม่ใช่แอดมินเปิดคิวอนุมัติไรเดอร์ไม่ได้', () =>
    repos.admin.pendingRiders(),
  );
  await mustReject('บัญชี user ส่งใบสมัครไรเดอร์ไม่ได้', () =>
    repos.rider.submitApplication({
      nationalId: '1101700635799', dateOfBirth: '2000-01-31',
      vehicleRegistration: '1กข 9999', licenceExpiry: '2030-12-31',
      compulsoryInsuranceExpiry: '2030-06-30',
      bankName: 'กสิกรไทย', bankAccountNumber: '1234567890', bankAccountName: 'สมชาย ใจดี',
      emergencyContactName: 'สมหญิง', emergencyContactPhone: '0898887777',
      acceptContract: true, acceptPdpa: true,
    }),
  );

  console.log('\nเงินสดในมือไรเดอร์ (§6.2)');

  await repos.auth.login('admin_root', SEED_PASSWORD);
  const holders = await repos.admin.ridersHoldingCash();
  check(
    'ทุกแถวมียอดมากกว่าศูนย์ ไม่มีแถวเปล่า',
    holders.every((h) => h.cashHeldSatang > 0 && Number.isInteger(h.cashHeldSatang)),
  );
  check(
    'ธงชนเพดานตรงกับยอดจริง',
    holders.every((h) => h.atLimit === (h.cashHeldSatang >= h.cashLimitSatang)),
  );

  if (holders.length > 0) {
    const target = holders[0]!;
    // รับเกินยอดที่ถืออยู่ไม่ได้ ฐานมี CHECK กันติดลบ แต่ต้องหยุดก่อนถึงตรงนั้น
    await mustReject('รับเงินเกินยอดที่ไรเดอร์ถืออยู่ไม่ได้', () =>
      repos.admin.settleRiderCash(target.accountId, target.cashHeldSatang + 1),
    );
    const settled = await repos.admin.settleRiderCash(target.accountId, 100);
    check(
      'รับนำส่งแล้วยอดลดลงจริง',
      settled.cashHeldSatang === target.cashHeldSatang - 100,
      `ได้ ${settled.cashHeldSatang}`,
    );
    check('ยอดคงเหลือยังเป็นจำนวนเต็มสตางค์', Number.isInteger(settled.cashHeldSatang));
  } else {
    check('ยังไม่มีไรเดอร์ถือเงินสด — ข้ามการทดสอบนำส่ง', true);
  }

  await repos.auth.login('somchai', SEED_PASSWORD);
  await mustReject('บัญชีที่ไม่ใช่แอดมินดูยอดเงินสดไรเดอร์ไม่ได้', () =>
    repos.admin.ridersHoldingCash(),
  );

  console.log('\nจอแอดมิน — ตัวเลขสดและคิวข้อยกเว้น (AD1 · AD2)');

  await repos.auth.login('admin_root', SEED_PASSWORD);

  const live = await repos.admin.liveOps();
  check('AD1 คืนตัวเลขสดครบ', [live.activeOrders, live.ridersOnline, live.unassigned,
    live.gmvTodaySatang].every(Number.isInteger), JSON.stringify(live));
  // null = "วันนี้ยังไม่มีใบไหนส่งถึง" ซึ่งต่างจาก 0 นาที จอต้องซ่อนแถว ไม่ใช่โชว์ศูนย์
  check('เวลาส่งกลางเป็น null ได้ ไม่ใช่ถูกบีบเป็น 0',
    live.medianDeliveryMinutes === null || live.medianDeliveryMinutes > 0,
    `ได้ ${live.medianDeliveryMinutes}`);
  check('ใบที่ยังไม่มีไรเดอร์ไม่เกินใบที่กำลังวิ่ง', live.unassigned <= live.activeOrders);

  const adminMetrics = await repos.admin.metrics();
  check('AD1 ใช้ตัวชี้วัดชนิดเดียวกับ SA1', typeof adminMetrics.windowDays === 'number');
  check('จำนวนที่ส่งถึงไม่เกินจำนวนออร์เดอร์ทั้งหมด',
    adminMetrics.delivered <= adminMetrics.orders,
    `${adminMetrics.delivered}/${adminMetrics.orders}`);

  const exceptions = await repos.admin.exceptions();
  const KINDS = ['unaccepted', 'no_rider', 'slow_delivery', 'open_dispute', 'rider_issue'];
  // §7 จอนี้เป็นคิว "ต้องมีคนเข้าไปยุ่ง" ไม่ใช่ฟีดออร์เดอร์ทั้งหมด
  check('ทุกแถวบอกชนิดที่รู้จัก', exceptions.every((e) => KINDS.includes(e.kind)),
    JSON.stringify(exceptions.map((e) => e.kind)));
  check('ทุกแถวบอกว่าต้องทำอะไร ไม่ใช่แค่ว่ามีอะไรผิด',
    exceptions.every((e) => e.detail.length > 0));
  check('ทุกแถวมีเลขที่ออร์เดอร์ที่อ่านออก',
    exceptions.every((e) => e.reference.startsWith('WD-')));
  check('เรื่องที่ไรเดอร์แจ้งพก id มาให้กดเคลียร์ได้ (R9)',
    exceptions.filter((e) => e.kind === 'rider_issue').every((e) => !!e.riderIssueId));

  const allOrders = await repos.admin.orders('all');
  const unassigned = await repos.admin.orders('unassigned');
  const delayed = await repos.admin.orders('delayed');
  check('AD2 กรองได้ทั้งสามค่า', [allOrders, unassigned, delayed].every(Array.isArray));
  // นิยาม "ไม่มีไรเดอร์" อยู่ฝั่งเซิร์ฟเวอร์ ผลที่กรองแล้วต้องเป็นสับเซตของทั้งหมดเสมอ
  check('ผลที่กรองแล้วเป็นสับเซตของทั้งหมด',
    unassigned.length <= allOrders.length && delayed.length <= allOrders.length,
    `${unassigned.length}/${delayed.length}/${allOrders.length}`);
  check('ทุกใบที่กรองว่าไม่มีไรเดอร์ไม่มีไรเดอร์จริง',
    unassigned.every((o) => !o.riderName));

  console.log('\nยอดค้างจ่ายร้าน + แผนที่ ops (AD7 · AD8)');

  const payables = await repos.admin.restaurantPayables();
  check('ทุกยอดเป็นจำนวนเต็มสตางค์',
    payables.every((p) => Number.isInteger(p.payableSatang)));
  // อ่านจาก ledger ไม่ใช่คำนวณใหม่จาก orders แถวที่ยอดเป็นศูนย์ไม่ควรโผล่มาให้กดจ่าย
  check('ไม่มีแถวยอดศูนย์ให้กดจ่ายเปล่า ๆ',
    payables.every((p) => p.payableSatang !== 0), JSON.stringify(payables));
  check('ทุกแถวบอกชื่อร้านและชื่อเจ้าของ',
    payables.every((p) => !!p.name && !!p.ownerName));

  const map = await repos.admin.opsMap();
  check('AD8 คืนทั้งหมุดไรเดอร์และหมุดออร์เดอร์',
    Array.isArray(map.riders) && Array.isArray(map.orders));
  /** พิกัด (0,0) อยู่กลางมหาสมุทรแอตแลนติก ถ้าหลุดมาแม้หมุดเดียว แผนที่จะซูมออก */
  const pins = [...map.riders, ...map.orders];
  check('ทุกหมุดมีพิกัดจริงในไทย ไม่ใช่ (0,0)',
    pins.every((p) => p.lat > 5 && p.lat < 21 && p.lng > 97 && p.lng < 106),
    JSON.stringify(pins.map((p) => [p.lat, p.lng])));
  check('หมุดออร์เดอร์บอกได้ว่าใบไหนยังไม่มีไรเดอร์',
    map.orders.every((o) => typeof o.hasRider === 'boolean'));

  console.log('\nคิวอนุมัติและเอกสาร KYC (AD5 · AD6)');

  const pendingShops = await repos.admin.pendingRestaurants();
  check('คิวอนุมัติร้านบอกจำนวนเมนูที่มี (§7)',
    pendingShops.every((s) => Number.isInteger(s.menuItemCount)));
  check('ทุกใบในคิวยังไม่อนุมัติ', pendingShops.every((s) => !s.isApproved));
  check('ทุกใบบอกเจ้าของและที่อยู่ให้ตรวจได้',
    pendingShops.every((s) => !!s.ownerName && !!s.addressText));

  // ต้องเป็นไรเดอร์ที่ส่งเอกสารมาแล้ว คิวรออนุมัติมีแต่คนที่ยังไม่ส่ง จึงหยิบ id ของแอนตรง ๆ
  await repos.auth.login('rider_ann', SEED_PASSWORD);
  const annId = (await repos.auth.restore())!.id;
  await repos.auth.login('admin_root', SEED_PASSWORD);

  const docs = await repos.admin.riderDocuments(annId);
  check('AD6 โชว์ครบหกชนิดเสมอ รวมที่ยังไม่ส่ง (§7)', docs.length === 6, `ได้ ${docs.length}`);
  // ชนิดที่ยังไม่ส่งต้องไม่มีลิงก์ให้กด ไม่งั้นแอดมินกดแล้วเจอ 404 โดยไม่รู้ว่าเพราะยังไม่ส่ง
  check('ชนิดที่ยังไม่ส่งไม่มีลิงก์',
    docs.filter((d) => d.status === 'missing').every((d) => d.url === null));
  check('ชนิดที่ส่งแล้วมีลิงก์ที่เซ็นชื่อมา ไม่ใช่ URL เปล่า',
    docs.filter((d) => d.status !== 'missing')
      .every((d) => !!d.url && d.url.includes('token=')),
    JSON.stringify(docs.map((d) => [d.status, d.url?.slice(0, 40)])));
  check('เอกสารที่ไม่ผ่านมีเหตุผลติดมาเสมอ',
    docs.filter((d) => d.status === 'rejected').every((d) => !!d.rejectionReason));

  // เอกสารที่ทดสอบคือใบที่ขั้นก่อนหน้าเพิ่งอัปขึ้นไป รันรอบใหม่ก็อัปทับ สถานะจึงรีเซ็ตเอง
  const uploaded = docs.find((d) => d.status !== 'missing');
  if (uploaded) {
    // ปฏิเสธโดยไม่บอกเหตุผลไม่ได้ ไรเดอร์จะไม่รู้ว่าต้องแก้อะไร แล้วส่งผิดซ้ำจนเลิกสมัคร
    await mustRejectWith('ปฏิเสธเอกสารโดยไม่บอกเหตุผลไม่ได้', 400, () =>
      repos.admin.decideRiderDocument(annId, uploaded.kind, { approve: false }),
    );
    const rejected = await repos.admin.decideRiderDocument(annId, uploaded.kind, {
      approve: false, rejectionReason: 'ทดสอบจากสคริปต์ตรวจแอป',
    });
    check('ปฏิเสธพร้อมเหตุผลได้', rejected.status === 'rejected' && !!rejected.rejectionReason);
    const approved = await repos.admin.decideRiderDocument(annId, uploaded.kind, { approve: true });
    check('อนุมัติกลับได้', approved.status === 'verified');
    check('อนุมัติแล้วเหตุผลเดิมไม่ค้างอยู่', approved.rejectionReason === null);
  } else {
    check('ไรเดอร์คนนี้ยังไม่ส่งเอกสารเลย — ข้ามการทดสอบตรวจเอกสาร', true);
  }

  console.log('\nคืนเงินและการจ่ายงานมือ (AD3 · §6.3)');

  const refunds = await repos.admin.openRefunds();
  check('คิวคืนเงินตอบเป็นรายการได้', Array.isArray(refunds));
  // §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ แอดมินต้องอ่านได้ว่าระบบคิดยังไงก่อนกดยืนยัน
  check('ทุกเคสมีเหตุผลรายข้อจากการตรวจอัตโนมัติ',
    refunds.every((r) => Array.isArray(r.reasoning) && r.reasoning.length > 0),
    JSON.stringify(refunds.map((r) => r.reasoning)));
  check('ทุกเคสในคิวยังไม่ถูกตัดสิน',
    refunds.every((r) => r.decidedAt === null && (r.status === 'open' || r.status === 'auto_verified')));
  check('ยอดที่เสนอเป็นจำนวนเต็มสตางค์หรือ null',
    refunds.every((r) => r.suggestedAmountSatang === null
      || Number.isInteger(r.suggestedAmountSatang)));

  /** ทางที่สำเร็จของ decideRefund กับ settleRestaurant เขียน ledger จริงและขยับเงินจริง */
  await mustRejectWith('เคสคืนเงินที่ไม่มีอยู่จริงตอบ 404 ไม่ใช่ 500', 404, () =>
    repos.admin.decideRefund('00000000-0000-4000-8000-000000000000', { approve: true }),
  );
  await mustRejectWith('จ่ายยอดให้ร้านที่ไม่มีอยู่จริงตอบ 404', 404, () =>
    repos.admin.settleRestaurant('00000000-0000-4000-8000-000000000000'),
  );

  const dispatched = await repos.admin.forceDispatch(order.id);
  check('สั่งจ่ายงานมือได้ และบอกผลว่าเสนอออกไปไหม',
    typeof dispatched.offered === 'boolean', JSON.stringify(dispatched));
  // จ่ายไม่ออกต้องบอกเหตุผล ไม่ใช่เงียบ แอดมินต้องรู้ว่าเพราะไม่มีไรเดอร์หรือเพราะใบยังไม่พร้อม
  check('จ่ายไม่ออกต้องบอกเหตุผล',
    dispatched.offered || !!dispatched.reason, JSON.stringify(dispatched));

  const payoutQueue = await repos.admin.riderPayouts();
  check('R12 คิวคำขอถอนตอบเป็นรายการได้', Array.isArray(payoutQueue));
  // ต้องรู้ว่าเป็นคำขอของใคร ไม่งั้นโอนเข้าบัญชีผิดคน
  check('ทุกคำขอบอกชื่อและเบอร์ของเจ้าของคำขอ',
    payoutQueue.every((r) => !!r.fullName && !!r.phone), JSON.stringify(payoutQueue));
  check('ทุกยอดเป็นจำนวนเต็มสตางค์ที่มากกว่าศูนย์',
    payoutQueue.every((r) => Number.isInteger(r.amountSatang) && r.amountSatang > 0));
  check('เรียงเก่าไปใหม่ คนที่รอนานสุดอยู่บนสุด',
    payoutQueue.every((r, i) => i === 0 || payoutQueue[i - 1]!.requestedAt <= r.requestedAt));

  /** ทางที่ยืนยันสำเร็จเขียน ledger จริง (§6.2 เขียนในทรานแซกชันเดียวกับการเปลี่ยนสถานะ) */
  if (payoutQueue[0]) {
    const target = payoutQueue[0];
    await mustRejectWith('ปฏิเสธคำขอถอนโดยไม่บอกเหตุผลไม่ได้', 400, () =>
      repos.admin.decideRiderPayout(target.id, { approve: false }),
    );
    const rejected = await repos.admin.decideRiderPayout(target.id, {
      approve: false, rejectionReason: 'ทดสอบจากสคริปต์ตรวจแอป',
    });
    check('ปฏิเสธพร้อมเหตุผลได้', rejected.status === 'rejected', JSON.stringify(rejected));
    check('เหตุผลถูกเก็บไว้ให้ไรเดอร์อ่าน', !!rejected.rejectionReason);
    check('มีเวลาที่ตัดสิน', !!rejected.decidedAt);
    check('ตัดสินแล้วหลุดจากคิว',
      !(await repos.admin.riderPayouts()).some((r) => r.id === target.id));
    await mustRejectWith('ตัดสินซ้ำไม่ได้', 409, () =>
      repos.admin.decideRiderPayout(target.id, { approve: false, rejectionReason: 'อีกครั้ง' }),
    );
  } else {
    await mustRejectWith('คำขอถอนที่ไม่มีอยู่จริงตอบ 404 ไม่ใช่ 500', 404, () =>
      repos.admin.decideRiderPayout('00000000-0000-4000-8000-000000000000', {
        approve: false, rejectionReason: 'ทดสอบ',
      }),
    );
  }

  await repos.auth.login('somchai', SEED_PASSWORD);
  await mustRejectWith('ลูกค้าเปิดคิวคำขอถอนไม่ได้', 403, () => repos.admin.riderPayouts());
  await mustRejectWith('ลูกค้าเปิดจอเฝ้าออร์เดอร์ไม่ได้', 403, () => repos.admin.orders('all'));
  await mustRejectWith('ลูกค้าเปิดแผนที่ ops ไม่ได้', 403, () => repos.admin.opsMap());
  await mustRejectWith('ลูกค้าเปิดเอกสาร KYC ของคนอื่นไม่ได้', 403, () =>
    repos.admin.riderDocuments(annId),
  );

  console.log('\nค่าที่แอปอ่านก่อนล็อกอิน (SA4)');

  await store.clear();
  const platform = await repos.config.get();
  // จอเลือกวิธีจ่ายวาดปุ่มจากรายการนี้ ไม่ใช่จากรายการที่ฝังไว้ในแอป
  check('ยังไม่ล็อกอินก็อ่านค่าแพลตฟอร์มได้', Array.isArray(platform.paymentMethods));
  check('พร้อมเพย์อยู่ในรายการเสมอ (§3 ข้อ 5)', platform.paymentMethods.includes('promptpay'));
  check('บอกได้ว่าเปิดรับสมัครอยู่ไหม', typeof platform.registrationOpen === 'boolean');

  console.log('\nตั๋วซัพพอร์ต (AD4)');

  await repos.auth.login('somchai', SEED_PASSWORD);
  const ticket = await repos.support.open({
    orderId: order.id,
    kind: 'order_problem',
    subject: 'ทดสอบจากสคริปต์ตรวจแอป',
    body: 'ข้อความแรกของเธรด',
  });
  check('ลูกค้าเปิดตั๋วได้', !!ticket.id);

  const myTickets = await repos.support.mine();
  const row = myTickets.find((x) => x.id === ticket.id);
  check('ตั๋วโผล่ในรายการของตัวเอง', !!row);
  check('รายการบอกเลขที่ออร์เดอร์ที่ผูกไว้ ไม่ใช่ uuid', !!row?.orderReference?.startsWith('WD-'));
  // 1 = ยังไม่มีใครตอบ จอ AD4 ใช้เลขนี้บอกว่าเธรดไหนรอคำตอบอยู่
  check('ข้อความแรกนับเป็นหนึ่งข้อความในเธรด', row?.messageCount === 1, `ได้ ${row?.messageCount}`);
  check('ตั๋วใหม่เปิดอยู่', row?.status === 'open');

  const thread = await repos.support.thread(ticket.id);
  check('เปิดเธรดอ่านได้', thread.ticket.id === ticket.id);
  check('ข้อความแรกอยู่ในเธรด ไม่ใช่คอลัมน์บนตั๋ว', thread.messages[0]?.body === 'ข้อความแรกของเธรด');
  check('ข้อความของลูกค้าไม่ได้ถูกทำเครื่องหมายว่ามาจากทีมงาน', thread.messages[0]?.fromStaff === false);

  await repos.support.reply(ticket.id, 'ขอเพิ่มเติมอีกข้อความ');
  check('เจ้าของตั๋วตอบเพิ่มได้', (await repos.support.thread(ticket.id)).messages.length === 2);

  await repos.auth.login('malee', SEED_PASSWORD);
  // §5.6 ตั๋วมักเป็นเรื่องร้องเรียนร้านหรือไรเดอร์ในออร์เดอร์นั้นเอง คนที่ถูกร้องเรียนจึงอ่านไม่ได้
  await mustReject('คนอื่นเปิดเธรดอ่านไม่ได้ แม้จะเป็นร้านในออร์เดอร์นั้น', () =>
    repos.support.thread(ticket.id),
  );

  await repos.auth.login('admin_root', SEED_PASSWORD);
  const adminQueue = await repos.admin.tickets();
  check('ตั๋วโผล่ในคิวของแอดมิน', adminQueue.some((x) => x.id === ticket.id));
  await repos.support.reply(ticket.id, 'ทีมงานตอบกลับ');
  const afterStaff = await repos.support.thread(ticket.id);
  check('คำตอบของแอดมินถูกทำเครื่องหมายว่ามาจากทีมงาน',
    afterStaff.messages[2]?.fromStaff === true);

  await repos.admin.closeTicket(ticket.id);
  check('แอดมินปิดตั๋วได้', (await repos.support.thread(ticket.id)).ticket.status === 'closed');
  await mustReject('ตั๋วที่ปิดแล้วตอบไม่ได้', () => repos.support.reply(ticket.id, 'ตอบทีหลัง'));

  console.log('\nซูเปอร์แอดมิน (SA1–SA6)');

  await repos.auth.login('admin_root', SEED_PASSWORD);
  // เส้นแบ่ง /admin/* กับ /super/* ต้องถูกบังคับที่เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนแท็บในแอป
  await mustReject('แอดมินธรรมดาเปิดจอตั้งค่าแพลตฟอร์มไม่ได้', () => repos.super.config());

  await repos.auth.login('super_root', SEED_PASSWORD);

  const metrics = await repos.super.metrics(30);
  check('SA1 คืนหน้าต่างเวลาที่ขอ', metrics.windowDays === 30, `ได้ ${metrics.windowDays}`);
  /** §8 null แปลว่า "ยังวัดไม่ได้" ไม่ใช่ 0 จอ SA1 ซ่อนทั้งช่องเมื่อเป็น null */
  const ratios = [
    metrics.restaurantAcceptRate, metrics.refundRate, metrics.autoDispatchRate,
    metrics.onTimeRate, metrics.promptPayRate, metrics.repeatOrderRate,
  ];
  check('อัตราส่วนทุกตัวเป็น null หรือเลข 0–1 ไม่ใช่เปอร์เซ็นต์ดิบ',
    ratios.every((r) => r === null || (typeof r === 'number' && r >= 0 && r <= 1)),
    JSON.stringify(ratios));
  check('ครบเก้าตัวชี้วัดที่ SA1 ต้องใช้',
    ['ordersPerRiderHour', 'restaurantAcceptRate', 'refundRate', 'autoDispatchRate',
      'contributionPerOrderSatang', 'medianDeliveryMinutes', 'onTimeRate',
      'promptPayRate', 'repeatOrderRate'].every((k) => k in metrics));
  check('ยอดเงินต่อออร์เดอร์เป็นจำนวนเต็มสตางค์หรือ null',
    metrics.contributionPerOrderSatang === null
      || Number.isInteger(metrics.contributionPerOrderSatang));

  const zoneReports = await repos.super.zones();
  check('SA2 เห็นโซนพร้อมตัวเลขรายพื้นที่', zoneReports.length > 0);
  check('ทุกโซนมีพิกัดเป็นตัวเลข ไม่ใช่สตริงจาก numeric ของ Postgres',
    zoneReports.every((z) => typeof z.lat === 'number' && typeof z.lng === 'number'));
  check('ตัวเลขรายโซนเป็นจำนวนเต็ม',
    zoneReports.every((z) => Number.isInteger(z.liveOrders) && Number.isInteger(z.ridersOnline)
      && Number.isInteger(z.gmvSatang)));

  /** โซนไม่มีเส้นทางลบ (เป็นรายงาน ไม่ใช่สวิตช์ product-spec §10) รันซ้ำจึงต้องไม่งอกใหม่ */
  const TEST_ZONE = 'โซนทดสอบ api-check';
  const zoneBefore = zoneReports.find((z) => z.name === TEST_ZONE);
  const testZone = zoneBefore ?? await repos.super.createZone({
    name: TEST_ZONE, type: 'mixed', lat: 13.7649, lng: 100.5383,
  });
  check(zoneBefore ? 'ใช้โซนทดสอบเดิม (สร้างไว้แล้วรอบก่อน)' : 'สร้างโซนใหม่ได้',
    testZone.name === TEST_ZONE);

  const zoneInput = { name: TEST_ZONE, lat: testZone.lat, lng: testZone.lng };
  const zoneAfter = await repos.super.updateZone(testZone.id, { ...zoneInput, type: 'office_district' });
  check('แก้โซนได้ และคืนค่าที่แก้แล้วกลับมา', zoneAfter.type === 'office_district',
    JSON.stringify(zoneAfter));
  await repos.super.updateZone(testZone.id, { ...zoneInput, type: 'mixed' });

  const admins = await repos.super.admins();
  check('SA3 เห็นรายชื่อผู้ดูแลระบบ', admins.length >= 2, `ได้ ${admins.length}`);
  check('รายชื่อมีแต่บทบาทผู้ดูแล ไม่มีลูกค้าหลุดมา',
    admins.every((a) => a.role === 'admin' || a.role === 'super_admin'));
  const me = admins.find((a) => a.username === 'super_root')!;
  // ลดสิทธิ์ตัวเอง = ไม่มีใครเหลือให้คืนสิทธิ์ ต้องไปแก้ที่ฐานเอง จึงห้ามตั้งแต่ต้นทาง
  await mustReject('ถอนสิทธิ์ตัวเองไม่ได้', () => repos.super.setRole(me.accountId, 'admin'));

  const root = admins.find((a) => a.username === 'admin_root')!;
  try {
    const promoted = await repos.super.setRole(root.accountId, 'super_admin');
    check('เลื่อนบทบาทให้คนอื่นได้', promoted.role === 'super_admin', JSON.stringify(promoted));
    check('ผลลัพธ์บอกว่าเปลี่ยนบัญชีไหน', promoted.accountId === root.accountId);
  } finally {
    // คืนสถานะเสมอ ไม่งั้น admin_root ค้างเป็นซูเปอร์ แล้วรอบหน้าเทสต์เส้นแบ่งสิทธิ์จะพัง
    await repos.super.setRole(root.accountId, 'admin');
  }
  check('ลดบทบาทกลับได้', (await repos.super.admins())
    .find((a) => a.username === 'admin_root')?.role === 'admin');

  const cfg = await repos.super.config();
  check('SA4+SA6 คืนราคากับ flag มาด้วยกันในครั้งเดียว', !!cfg.pricing && !!cfg.flags);
  check('ค่าคอมเป็นจุดฐาน 1500 = 15% (§6.1)',
    cfg.pricing.commissionRateBp === 1500, `ได้ ${cfg.pricing.commissionRateBp}`);
  check('ทุกช่องราคาเป็นจำนวนเต็ม',
    [cfg.pricing.deliveryBaseSatang, cfg.pricing.deliveryPerKmSatang, cfg.pricing.serviceFeeSatang]
      .every(Number.isInteger));
  // รายการ flag มาจากเซิร์ฟเวอร์ ไม่ใช่รายการที่แอปฝังไว้ ไม่งั้นสองฝั่งเลื่อนออกจากกันเงียบ ๆ
  check('flagKeys มาจากเซิร์ฟเวอร์และมีสี่ตัวที่ทำจริง',
    cfg.flagKeys.length === 4 && cfg.flagKeys.every((k) => k in cfg.flags), JSON.stringify(cfg.flagKeys));
  check('ไม่มี flag ของพร้อมเพย์ให้ปิด (§3 ข้อ 5)',
    !cfg.flagKeys.includes('promptpay_payment' as never));

  const pricingBefore = cfg.pricing;
  try {
    const bumped = await repos.super.setPricing({
      commissionRateBp: pricingBefore.commissionRateBp,
      deliveryBaseSatang: pricingBefore.deliveryBaseSatang,
      deliveryPerKmSatang: pricingBefore.deliveryPerKmSatang,
      serviceFeeSatang: 700,
    });
    check('SA6 แก้ค่าบริการได้', bumped.serviceFeeSatang === 700, JSON.stringify(bumped));
    check('แก้แล้วมีเวลาที่แก้ล่าสุดติดมา', !!bumped.updatedAt);
  } finally {
    await repos.super.setPricing({
      commissionRateBp: pricingBefore.commissionRateBp,
      deliveryBaseSatang: pricingBefore.deliveryBaseSatang,
      deliveryPerKmSatang: pricingBefore.deliveryPerKmSatang,
      serviceFeeSatang: pricingBefore.serviceFeeSatang,
    });
  }

  try {
    const off = await repos.super.setFlag('card_payment', false);
    check('ปิด flag บัตรได้', off.enabled === false && off.key === 'card_payment');
    // flag ที่แค่ซ่อนปุ่มในแอปคือ flag ที่ไคลเอนต์ดัดแปลงเดินผ่านได้ ต้องหายจาก /config ด้วย
    await store.clear();
    check('ปิดแล้วบัตรหายจากค่าที่แอปอ่าน',
      !(await repos.config.get()).paymentMethods.includes('card'));
  } finally {
    await repos.auth.login('super_root', SEED_PASSWORD);
    await repos.super.setFlag('card_payment', true);
  }
  check('เปิดกลับแล้วบัตรโผล่อีกครั้ง',
    (await repos.config.get()).paymentMethods.includes('card'));

  const audit = await repos.super.audit();
  check('SA5 อ่านประวัติการกระทำได้', audit.length > 0);
  check('ทุกแถวบอกว่าใครทำ ไม่ใช่แค่ id',
    audit.every((a) => !!a.actorUsername && !!a.actorName));
  check('การเปลี่ยนบทบาทเมื่อครู่ถูกบันทึกไว้',
    audit.some((a) => a.action === 'role.changed'));
  check('การเปลี่ยนราคาเก็บทั้งค่าเก่าและค่าใหม่ (§6.1 ห้ามเลื่อนเงียบ ๆ)',
    audit.filter((a) => a.action === 'pricing.changed').every((a) => !!a.before && !!a.after));
  const onlyRoles = await repos.super.audit('role.changed');
  check('กรองตามชนิดการกระทำได้', onlyRoles.every((a) => a.action === 'role.changed'));

  await repos.auth.login('somchai', SEED_PASSWORD);
  await mustReject('ลูกค้าอ่านประวัติการกระทำไม่ได้', () => repos.super.audit());

  console.log('\nสมัครสมาชิก — OTP แล้วค่อยตั้งบัญชี (§4.2)');

  /** บัญชีทดสอบตัวเดียวใช้ซ้ำทุกรอบ ไม่งอกใหม่ทุกครั้งที่รัน (ไม่มีเส้นทางลบบัญชี) */
  const TEST_PHONE = '0800000199';
  const TEST_USER = 'apicheck_user';

  await store.clear();
  let testAccount: Account;
  try {
    const otp = await repos.auth.requestOtp(TEST_PHONE);
    check('ขอ OTP ให้เบอร์ใหม่ได้ และโหมด dev ส่งรหัสกลับมาให้ทดสอบ', !!otp.devCode, JSON.stringify(otp));
    const verificationToken = await repos.auth.verifyOtp(TEST_PHONE, otp.devCode!);
    check('ยืนยัน OTP แล้วได้ตั๋วมาใช้ต่อ', verificationToken.length > 0);
    await mustRejectWith('รหัส OTP ผิดถูกปฏิเสธ', 400, () =>
      repos.auth.verifyOtp(TEST_PHONE, '000000'),
    );
    testAccount = await repos.auth.register({
      username: TEST_USER, password: SEED_PASSWORD, fullName: 'บัญชีทดสอบสคริปต์',
      phone: TEST_PHONE, accountType: 'user', verificationToken,
    });
    check('สมัครแล้วได้บัญชีใหม่พร้อมเซสชัน', testAccount.username === TEST_USER);
  } catch {
    // สมัครไว้แล้วตั้งแต่รอบก่อน เบอร์ซ้ำจึงขอ OTP ไม่ผ่าน ซึ่งเป็นพฤติกรรมที่ถูกต้อง
    testAccount = await repos.auth.login(TEST_USER, SEED_PASSWORD);
    check('ใช้บัญชีทดสอบเดิม (สมัครไว้แล้วรอบก่อน)', testAccount.username === TEST_USER);
  }
  check('บัญชีที่สมัครใหม่เป็นชนิด user', testAccount.accountType === 'user');
  check('เบอร์ที่ยืนยันแล้วถูกผูกกับบัญชี', testAccount.phone === TEST_PHONE);

  // §4.2 ตั๋ว Google ปลอมต้องตกที่ชั้นตรวจลายเซ็น ไม่ใช่ผ่านเข้าไปสร้างบัญชีได้
  await mustRejectWith('สมัครด้วยตั๋ว Google ปลอมไม่ได้', 401, () =>
    repos.auth.googleRegister({
      googleToken: 'ไม่ใช่ token จริง', username: 'apicheck_google',
      fullName: 'ทดสอบ', phone: '0800000198', accountType: 'user',
      verificationToken: 'ไม่ใช่ตั๋วจริง',
    }),
  );

  await repos.auth.login(TEST_USER, SEED_PASSWORD);
  await repos.auth.logout();
  check('ออกจากระบบแล้วตั๋วถูกลบจากเครื่อง', !store.get());
  check('ออกแล้ว restore คืน null ไม่ใช่บัญชีเดิม', (await repos.auth.restore()) === null);

  console.log('\nที่อยู่ของไรเดอร์ที่สั่งอาหารเอง (§4.3)');

  /** ใช้บัญชีไรเดอร์โดยตั้งใจ §4.3 บอกว่าบัญชี rider สั่งอาหารได้เหมือนลูกค้า */
  await repos.auth.login('rider_ann', SEED_PASSWORD);
  const annAddresses = await repos.addresses.list();
  const TEST_LABEL = 'ที่อยู่ทดสอบ api-check';
  const existingAddress = annAddresses.find((a) => a.label === TEST_LABEL);
  const address = existingAddress ?? await repos.addresses.add({
    label: TEST_LABEL, addressText: 'ซอยอารีย์ 5', lat: 13.7808, lng: 100.5441,
  });
  check(existingAddress ? 'ใช้ที่อยู่ทดสอบเดิม' : 'เพิ่มที่อยู่ใหม่ได้', address.label === TEST_LABEL);
  check('พิกัดที่ส่งไปถูกเก็บเป็นตัวเลข ไม่ใช่สตริง',
    typeof address.lat === 'number' && typeof address.lng === 'number');

  console.log('\nเปิดร้านเอง (§4.3 · AD5)');

  await repos.auth.login(TEST_USER, SEED_PASSWORD);
  const TEST_SHOP = 'ร้านทดสอบ api-check';
  const myShopList = await repos.merchant.myRestaurants();
  const shop = myShopList.find((s) => s.name === TEST_SHOP)
    ?? await repos.merchant.registerRestaurant({
      name: TEST_SHOP, cuisine: 'rice', addressText: 'ซอยอารีย์ 7',
      lat: 13.7801, lng: 100.5432, prepTimeMinutes: 15,
      bankName: 'กสิกรไทย', bankAccountNumber: '1234567890', bankAccountName: 'บัญชีทดสอบสคริปต์',
    });
  check('บัญชี user เปิดร้านได้ (merchant เป็นความสามารถ ไม่ใช่ชนิดบัญชี)', shop.name === TEST_SHOP);
  // §4.3 ร้านใหม่ต้องยังไม่อนุมัติและยังไม่เปิดขาย ไม่งั้นใครก็เปิดร้านขายได้ทันที
  check('ร้านใหม่ยังไม่อนุมัติและยังไม่เปิดขาย', !shop.isApproved && !shop.isOpen);

  // §7 ต้องมีเมนูตั้งต้นก่อนถึงส่งตรวจได้ ร้านเปล่าให้แอดมินตรวจก็ไม่มีอะไรให้ตรวจ
  const MIN_MENU = 3;
  const shopMenu = await repos.catalog.getMenu(shop.id);
  if (shopMenu.length < MIN_MENU) {
    await mustRejectWith(`เมนูยังไม่ถึง ${MIN_MENU} รายการ ส่งตรวจไม่ได้`, 400, () =>
      repos.merchant.submitForApproval(shop.id),
    );
  }
  let item = shopMenu[0];
  for (let i = shopMenu.length; i < MIN_MENU; i += 1) {
    item = await repos.catalog.createMenuItem({
      restaurantId: shop.id, name: `ข้าวผัดทดสอบ ${i + 1}`, description: 'สร้างโดยสคริปต์ตรวจแอป',
      price: 5000, category: 'rice', isAvailable: true, optionGroups: [],
    });
  }
  check('ร้านเพิ่มเมนูได้ และราคาเป็นสตางค์จำนวนเต็ม',
    Number.isInteger(item!.price) && item!.price === 5000, `ได้ ${item!.price}`);
  check('เมนูครบตามจำนวนขั้นต่ำแล้ว',
    (await repos.catalog.getMenu(shop.id)).length >= MIN_MENU);

  const submitted = await repos.merchant.submitForApproval(shop.id);
  check('มีเมนูแล้วส่งตรวจได้', submitted.submitted === true, JSON.stringify(submitted));

  /** ไม่กดอนุมัติร้านนี้โดยตั้งใจ catalog ฝั่งลูกค้ากรองแค่ `isApproved` ไม่ได้กรอง `isOpen` */
  await mustRejectWith('เจ้าของอนุมัติร้านตัวเองไม่ได้', 403, () =>
    repos.admin.decideRestaurant(shop.id, true),
  );

  await repos.auth.login('admin_root', SEED_PASSWORD);
  check('ร้านที่ส่งตรวจโผล่ในคิวของแอดมิน',
    (await repos.admin.pendingRestaurants()).some((s) => s.id === shop.id));

  const stillPending = (await repos.admin.pendingRiders())[0];
  if (stillPending) {
    /** ปฏิเสธโดยไม่บอกเหตุผลต้องตกที่ชั้นตรวจข้อมูล (400) ไม่ใช่ 404 ซึ่งพิสูจน์ว่า */
    await mustRejectWith('ปฏิเสธใบสมัครไรเดอร์โดยไม่บอกเหตุผลไม่ได้', 400, () =>
      repos.admin.decideRider(stillPending.accountId, { approve: false }),
    );
  } else {
    check('ไม่มีใบสมัครไรเดอร์รอตรวจ — ข้ามการทดสอบตัดสินใบสมัคร', true);
  }

  console.log('\nแจ้งปัญหาเพื่อขอคืนเงิน (§6.4)');

  await repos.auth.login('somchai', SEED_PASSWORD);
  const myCases = await repos.refunds.mine();
  check('ลูกค้าดูเรื่องที่ตัวเองแจ้งไว้ได้', Array.isArray(myCases));
  check('ทุกเรื่องเป็นของออร์เดอร์ที่มีอยู่จริง', myCases.every((c) => !!c.orderId));

  /** ออร์เดอร์ทดสอบยังไม่ถูกส่งถึง (สคริปต์นี้ตั้งใจไม่เดินถึง delivered เพราะนั่นเขียน ledger */
  await mustRejectWith('ออร์เดอร์ที่ยังไม่ถึงมือลูกค้าแจ้งขอคืนเงินไม่ได้', 400, () =>
    repos.refunds.open({ orderId: order.id, reason: 'wrong_item', detail: 'ทดสอบจากสคริปต์' }),
  );
  await mustRejectWith('แจ้งแทนออร์เดอร์ของคนอื่นไม่ได้ และตอบ 404 ไม่ยืนยันว่ามีใบนี้', 404, () =>
    repos.refunds.open({
      orderId: '00000000-0000-4000-8000-000000000000',
      reason: 'wrong_item', detail: 'ทดสอบจากสคริปต์',
    }),
  );

  console.log('\nแชทของออร์เดอร์ (C10 · M10)');

  await repos.auth.login('somchai', SEED_PASSWORD);
  await repos.chat.send(order.id, 'customer_merchant', 'ขอเผ็ดน้อยหน่อยครับ');
  const shopThread = await repos.chat.thread(order.id, 'customer_merchant');
  check('ลูกค้าคุยกับร้านได้', shopThread.messages.at(-1)?.body === 'ขอเผ็ดน้อยหน่อยครับ');
  // จอวางข้อความซ้าย/ขวาจากค่านี้ ไม่ได้เทียบ id เอง
  check('ข้อความของตัวเองถูกทำเครื่องหมายว่าเป็นของตัวเอง', shopThread.messages.at(-1)?.mine === true);
  check('บอกได้ว่ากำลังคุยกับใคร', !!shopThread.peerName, JSON.stringify(shopThread.peerName));
  check('ออร์เดอร์ที่ยังเดินอยู่ ห้องยังเปิดรับข้อความ', shopThread.closed === false);
  await mustRejectWith('ข้อความว่างส่งไม่ได้', 400, () =>
    repos.chat.send(order.id, 'customer_merchant', '   '),
  );

  await repos.auth.login('malee', SEED_PASSWORD);
  const asShop = await repos.chat.thread(order.id, 'customer_merchant');
  check('ร้านเห็นข้อความของลูกค้า', asShop.messages.some((m) => m.body === 'ขอเผ็ดน้อยหน่อยครับ'));
  check('ฝั่งร้านเห็นว่าข้อความนั้นไม่ใช่ของตัวเอง',
    asShop.messages.at(-1)?.mine === false);

  /** ข้อที่พลาดแล้วเจ็บที่สุด ลูกค้าบอกไรเดอร์ว่า "รหัสประตู 1234 ห้อง 502" */
  await mustRejectWith('ร้านอ่านช่องที่ลูกค้าคุยกับไรเดอร์ไม่ได้', 404, () =>
    repos.chat.thread(order.id, 'customer_rider'),
  );

  await repos.auth.login('admin_root', SEED_PASSWORD);
  await mustRejectWith('แอดมินก็อ่านแชทไม่ได้ — เรื่องที่ต้องมีคนกลางไปทางตั๋ว (AD4)', 404, () =>
    repos.chat.thread(order.id, 'customer_merchant'),
  );

  await repos.auth.login('rider_new', SEED_PASSWORD);
  await mustRejectWith('คนนอกอ่านไม่ได้', 404, () =>
    repos.chat.thread(order.id, 'customer_merchant'),
  );

  await repos.auth.login('somchai', SEED_PASSWORD);
  await mustRejectWith('ห้องของออร์เดอร์ที่ไม่มีอยู่จริงตอบ 404', 404, () =>
    repos.chat.thread('00000000-0000-4000-8000-000000000000', 'customer_merchant'),
  );

  console.log('\nทิปให้ไรเดอร์ (C11)');

  await repos.auth.login('somchai', SEED_PASSWORD);
  check('ออร์เดอร์ที่ยังไม่ให้ทิปเป็นศูนย์ ไม่ใช่ค่าว่าง',
    (await repos.orders.get(order.id))?.tipSatang === 0);

  /** ทางที่สำเร็จเขียน ledger จริง (เดบิต cash / เครดิต rider_payable) ซึ่งลบคืนไม่ได้ */
  await mustRejectWith('ออร์เดอร์ที่ยังไม่ถึงมือลูกค้า ให้ทิปไม่ได้', 400, () =>
    repos.orders.tip(order.id, 2_000),
  );
  await mustRejectWith('ยอดทิปติดลบถูกปฏิเสธตั้งแต่ชั้นตรวจข้อมูล', 400, () =>
    repos.orders.tip(order.id, -100),
  );
  await mustRejectWith('ยอดทิปที่ไม่ใช่จำนวนเต็มสตางค์ถูกปฏิเสธ', 400, () =>
    repos.orders.tip(order.id, 20.5),
  );
  await mustRejectWith('ให้ทิปออร์เดอร์ที่ไม่มีอยู่จริงตอบ 404', 404, () =>
    repos.orders.tip('00000000-0000-4000-8000-000000000000', 2_000),
  );

  console.log('\nรีวิว (C11 · C36 · M9)');

  await repos.auth.login('somchai', SEED_PASSWORD);
  const shopReviews = await repos.reviews.forRestaurant(malee.id);
  // ไม่ต้องล็อกอินก็อ่านได้ เหมือนรายชื่อร้าน ลูกค้าใหม่ต้องตัดสินใจได้ก่อนสมัคร
  check('อ่านรีวิวของร้านได้', Array.isArray(shopReviews.reviews));
  check('สรุปคืนครบห้าระดับเสมอ แม้ระดับที่ไม่มีใครให้',
    shopReviews.breakdown.map((b) => b.stars).join(',') === '5,4,3,2,1',
    JSON.stringify(shopReviews.breakdown));
  check('ผลรวมของแท่งเท่ากับจำนวนรีวิว',
    shopReviews.breakdown.reduce((sum, b) => sum + b.count, 0) === shopReviews.count);
  /** §10 ยังไม่มีใครรีวิวคือ "ยังวัดไม่ได้" ไม่ใช่ 0 ดาว ถ้าเซิร์ฟเวอร์ส่ง 0 มาแทน */
  check('ยังไม่มีรีวิว = null ไม่ใช่ 0 ดาว',
    shopReviews.count > 0 ? typeof shopReviews.average === 'number' : shopReviews.average === null,
    `${shopReviews.count} รีวิว · เฉลี่ย ${shopReviews.average}`);
  check('คะแนนบนการ์ดร้านตรงกับค่าเฉลี่ยที่จอรีวิวคำนวณ',
    (await repos.catalog.getRestaurant(malee.id))?.rating === shopReviews.average,
    `การ์ด ${(await repos.catalog.getRestaurant(malee.id))?.rating} · สรุป ${shopReviews.average}`);

  /** ออร์เดอร์ทดสอบยังไม่ถึง delivered (สคริปต์นี้ไม่เดินถึงตรงนั้น เพราะเขียน ledger ที่ลบคืนไม่ได้) */
  await mustRejectWith('ออร์เดอร์ที่ยังไม่ถึงมือลูกค้า รีวิวไม่ได้', 400, () =>
    repos.reviews.write(order.id, { restaurantRating: 5 }),
  );
  await mustRejectWith('ดาวนอกช่วง 1–5 ถูกปฏิเสธตั้งแต่ชั้นตรวจข้อมูล', 400, () =>
    repos.reviews.write(order.id, { restaurantRating: 9 }),
  );
  check('ออร์เดอร์ที่ยังไม่รีวิวคืน null ไม่ใช่โยน error',
    (await repos.reviews.forOrder(order.id)) === null);

  await repos.auth.login('malee', SEED_PASSWORD);
  const mineAsOwner = await repos.reviews.forMyRestaurant(malee.id);
  check('M9 เจ้าของร้านอ่านรีวิวของร้านตัวเองได้', mineAsOwner.count === shopReviews.count);

  await repos.auth.login('somchai', SEED_PASSWORD);
  // ตอบ 404 ไม่ใช่ 403 ไม่ยืนยันว่าร้านรหัสนี้มีอยู่จริงให้คนที่ไม่ใช่เจ้าของ
  await mustRejectWith('คนอื่นเปิดรีวิวฝั่งร้านของคนอื่นไม่ได้', 404, () =>
    repos.reviews.forMyRestaurant(malee.id),
  );

  console.log('\nGoogle sign-in');

  await mustReject('id_token ปลอมถูกปฏิเสธ', () => repos.auth.googleSignIn('ไม่ใช่ token จริง'));
  await mustReject('ขอ OTP ให้เบอร์ที่สมัครแล้วถูกปฏิเสธ', () => repos.auth.requestOtp('0812345678'));

  // เก็บกวาด: ยกเลิกออร์เดอร์ที่สร้างไว้ ไม่ให้ค้างเป็นออร์เดอร์ที่ยังไม่จบในแอป
  await repos.orders.updateStatus(order.id, 'cancelled');
  console.log('\n(ยกเลิกออร์เดอร์ทดสอบแล้ว — ยังอยู่ในประวัติ ซึ่งรับได้สำหรับฐานที่ใช้พัฒนา)');
}

main()
  .catch((error) => {
    console.error('\nสคริปต์ล้มกลางคัน:', error?.message ?? error);
    failed += 1;
  })
  .finally(() => {
    console.log(`\nผ่าน ${passed} · ไม่ผ่าน ${failed}\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
