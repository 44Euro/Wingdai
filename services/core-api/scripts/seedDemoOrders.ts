import 'dotenv/config';

/**
 * ออร์เดอร์ตั้งต้นของฐานสาธิต ยิงผ่าน HTTP จริงแทนการ insert ตรง
 * เพราะเส้นทางเดียวกันนี้เป็นตัวลง ledger เปลี่ยนสถานะ และตรวจกติกาทั้งหมด (product-spec §6.2)
 * ต้องรันหลัง seed เสมอ ไม่งั้นไม่มีร้านให้สั่ง
 */
const BASE = process.env.DEMO_API_URL ?? 'http://localhost:3000/api';
const PASSWORD = 'wingdai1234';

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

function expect(label: string, res: Res, ok = [200, 201]) {
  if (!ok.includes(res.status)) {
    throw new Error(`${label} — ได้ ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function login(username: string): Promise<string> {
  const res = await call('POST', '/auth/login', { identifier: username, password: PASSWORD });
  return expect(`ล็อกอิน ${username}`, res).token as string;
}

/** จานแรกของร้านที่ยังขายอยู่ พร้อมตัวเลือกที่บังคับต้องเลือก */
function pickDish(menu: any[]) {
  const dish = menu.find((m) => m.isAvailable);
  if (!dish) throw new Error('ร้านนี้ไม่มีเมนูที่ขายอยู่');
  const required = (dish.optionGroups ?? []).filter((g: any) => g.minSelect > 0);
  return {
    menuItemId: dish.id as string,
    choiceIds: required.map((g: any) => g.choices[0].id as string),
  };
}

async function main() {
  const [customer, merchant, rider, admin] = await Promise.all(
    ['somchai', 'chai', 'rider_ann', 'admin_root'].map(login),
  );

  const existing = expect('อ่านออร์เดอร์เดิม', await call('GET', '/orders', undefined, customer));
  if (existing.length > 0) {
    console.log(`มีออร์เดอร์อยู่แล้ว ${existing.length} ใบ ไม่ทำอะไรต่อ`);
    return;
  }

  const shops = expect('อ่านรายชื่อร้าน', await call('GET', '/catalog/restaurants'));
  const open = shops.filter((s: any) => s.isOpen);
  if (open.length < 4) throw new Error(`ร้านที่เปิดอยู่มีแค่ ${open.length} ร้าน ต้องรัน seed ก่อน`);

  async function place(shop: any, note: string) {
    const menu = expect('อ่านเมนู', await call('GET', `/catalog/restaurants/${shop.id}/menu`));
    const dish = pickDish(menu);
    const order = expect(
      `สั่งจาก ${shop.name}`,
      await call('POST', '/orders', {
        restaurantId: shop.id,
        items: [{ ...dish, quantity: 1, note }],
        paymentMethod: 'promptpay',
      }, customer),
    );
    return order.id as string;
  }

  // ใบที่หนึ่ง ร้านยังไม่กด ค้างอยู่ในจอออร์เดอร์เข้าใหม่ของร้าน (design M4)
  await place(open[0], 'ไม่ใส่ผักชี');

  // ใบที่สอง ร้านรับแล้วกำลังทำ ยังไม่มีไรเดอร์
  const cooking = await place(open[1], 'เผ็ดน้อย');
  expect('ร้านรับใบที่สอง', await call('PATCH', `/orders/${cooking}/status`, { status: 'accepted' }, merchant));
  expect('ร้านเริ่มทำใบที่สอง', await call('PATCH', `/orders/${cooking}/status`, { status: 'preparing' }, merchant));

  expect(
    'ไรเดอร์เปิดรับงาน',
    await call('POST', '/rider/online', { isOnline: true, lat: 13.7805, lng: 100.5435 }, rider),
  );

  /** พาใบหนึ่งใบไปจนถึงมือไรเดอร์ ผ่านทางแทรกมือของแอดมิน (§6.3) จะได้ไม่ต้องรอรอบจ่ายงาน */
  async function toRider(orderId: string) {
    expect('ร้านรับ', await call('PATCH', `/orders/${orderId}/status`, { status: 'accepted' }, merchant));
    expect('แอดมินสั่งจ่ายงาน', await call('POST', `/admin/dispatch/orders/${orderId}`, undefined, admin));
    expect('ไรเดอร์รับงาน', await call('POST', `/rider/jobs/${orderId}/accept`, undefined, rider));
    expect('ร้านเริ่มทำ', await call('PATCH', `/orders/${orderId}/status`, { status: 'preparing' }, merchant));
    expect('ไรเดอร์รับของ', await call('PATCH', `/orders/${orderId}/status`, { status: 'picked_up' }, rider));
  }

  // ใบที่สาม กำลังเดินทาง จอติดตามของลูกค้าและงานที่ค้างของไรเดอร์มีของให้ดู
  const enRoute = await place(open[2], '');
  await toRider(enRoute);

  // ใบที่สี่ ส่งถึงแล้ว มีใบเสร็จ รีวิว ทิป และรายการบัญชีครบวง
  const done = await place(open[3], 'ขอช้อนส้อมด้วย');
  await toRider(done);
  const view = expect('ลูกค้าเปิดใบที่สี่', await call('GET', `/orders/${done}`, undefined, customer));
  expect(
    'ไรเดอร์ปิดงาน',
    await call('PATCH', `/orders/${done}/status`, { status: 'delivered', deliveryPin: view.deliveryPin }, rider),
  );
  expect(
    'ลูกค้ารีวิว',
    await call('POST', `/orders/${done}/review`, {
      restaurantRating: 5,
      riderRating: 5,
      comment: 'อาหารร้อน ส่งเร็วกว่าที่บอกไว้',
    }, customer),
    [200, 201],
  );
  expect('ลูกค้าให้ทิป', await call('POST', `/orders/${done}/tip`, { amountSatang: 2000 }, customer));

  expect(
    'เปิดตั๋วซัพพอร์ต',
    await call('POST', '/support/tickets', {
      orderId: done,
      kind: 'order_problem',
      subject: 'ได้รับของไม่ครบ',
      body: 'สั่งไว้สองอย่าง แต่ในถุงมีแค่อย่างเดียว รบกวนช่วยตรวจสอบให้ด้วยครับ',
    }, customer),
  );

  expect('ไรเดอร์ปิดรับงาน', await call('POST', '/rider/online', { isOnline: false }, rider));

  console.log('ออร์เดอร์สาธิต 4 ใบ (รอร้านรับ · กำลังทำ · กำลังส่ง · ส่งถึงแล้ว) พร้อมรีวิวและตั๋วซัพพอร์ต 1 ใบ');
}

main().catch((error) => {
  console.error('สร้างออร์เดอร์สาธิตไม่สำเร็จ:', (error as Error).message);
  process.exit(1);
});
