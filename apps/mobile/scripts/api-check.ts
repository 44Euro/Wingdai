import { createHttpRepos } from '../src/data/http';
import { createMemoryTokenStore } from '../src/data/http/tokenStore';

/**
 * ยิงโค้ดฝั่งแอปของจริงไปหา core-api ที่รันอยู่จริง
 *
 * **ทำไมไม่ทำเป็นเทสต์ jest** — jest-expo แทนที่ `fetch` ทั่วโลกด้วย polyfill ของ React Native
 * ที่วิ่งบน XMLHttpRequest ซึ่งไม่มีชั้นเน็ตเวิร์กจริงในเครื่องทดสอบ (คืน `res.status` เป็น undefined)
 * ต่อให้สั่ง `@jest-environment node` ก็ยังโดนทับ เพราะ polyfill ลงใน setupFiles ของ preset
 *
 * **ทำไมต้องมีทั้งที่ฝั่งเซิร์ฟเวอร์มี api.smoke.ts อยู่แล้ว** — ตัวนั้นพิสูจน์ว่าเซิร์ฟเวอร์ถูก
 * แต่ไม่ได้พิสูจน์ว่า *แอปเรียกถูก* เส้นทาง URL การแนบ Bearer token และการแปลงคำตอบ
 * เป็นชนิดที่จอใช้ ทั้งหมดอยู่ในไฟล์ฝั่งแอป และการแตะหน้าจอ simulator อัตโนมัติทำไม่ได้
 * (ไม่มีสิทธิ์ Accessibility) นี่จึงเป็นวิธีเดียวที่ยืนยันชั้นนี้ได้อัตโนมัติ
 *
 * ใช้:
 *   cd services/core-api && npm run dev        # อีกหน้าต่าง
 *   cd apps/mobile && npm run api:check
 */
const BASE_URL = process.env.WINGDAI_API_URL ?? 'http://localhost:3000/api';

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

const store = createMemoryTokenStore();
const repos = createHttpRepos(BASE_URL, store);

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
  // claude.md §4.2 — เบอร์โทรเป็น identifier ได้เหมือน username
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
  /*
   * numeric ของ Postgres ถูกส่งกลับมาเป็น "สตริง" ถ้าไม่ cast เป็น float8
   * ซึ่งผ่าน JSON มาแล้วจอจะพังตอนเรียก .toFixed() — เคยเจอมาแล้วรอบนี้
   */
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
  // claude.md §6.5 — เงินสดไม่พอแล้วจ่ายพร้อมเพย์แทน ไรเดอร์ไม่ต้องออกเงิน
  check('เปลี่ยนไปจ่ายพร้อมเพย์ได้', paid.paymentMethod === 'promptpay' && paid.paymentStatus === 'paid');
  await mustReject('กดจ่ายซ้ำไม่ได้', () => repos.orders.payWithPromptPay(order.id));

  const reread = await repos.orders.get(order.id);
  check('อ่านซ้ำแล้วยังจ่ายแล้ว', reread?.paymentStatus === 'paid');

  const mine = await repos.orders.listForCustomer(account.id);
  check('ออร์เดอร์อยู่ในประวัติของตัวเอง', mine.some((o) => o.id === order.id));

  console.log('\nที่อยู่จัดส่ง');

  const addresses = await repos.addresses.list();
  check('ดึงที่อยู่ของตัวเองได้', addresses.length > 0);
  check(
    'ที่อยู่มีพิกัดเป็นตัวเลข',
    typeof addresses[0]?.lat === 'number' && typeof addresses[0]?.lng === 'number',
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
