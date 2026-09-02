import 'dotenv/config';
import { withRetry } from './fetchRetry';
import { mapLimit } from './mapLimit';
import { runQueue, assertEnough } from './seedRun';
import { createScriptClient } from '../src/db/client';

/**
 * ประวัติการสั่ง 7 วันย้อนหลังของฐานสาธิต
 *
 * ตัวเลขในจอแอดมินกับซูเปอร์แอดมินคำนวณถูกอยู่แล้ว แต่ถ้าฐานมีออเดอร์ 4 ใบที่เกิดในนาทีเดียวกัน
 * ตัวหารจะเล็กจนอ่านไม่ได้ ("51.25 ออเดอร์ต่อชั่วโมงต่อไรเดอร์" · "ค่ากลางเวลาส่ง 0 นาที")
 * สคริปต์นี้จึงยิงออเดอร์ผ่าน HTTP จริงเพื่อให้ ledger กับ state machine ทำงานครบ
 * แล้วค่อย ย้อนเวลา ด้วย SQL ให้กระจายตามช่วงเวลากินข้าวของเจ็ดวันที่ผ่านมา
 *
 * ต้องรันหลัง db:seed และ db:demo-orders เสมอ
 */
const BASE = process.env.DEMO_API_URL ?? 'http://localhost:3000/api';
const PASSWORD = 'wingdai1234';

/**
 * เขียนออกทันทีทีละบรรทัด ไม่ผ่านบัฟเฟอร์ของ console.log
 * รอบเต็มกินเวลาสิบกว่านาที ถ้าโดนฆ่ากลางคันบรรทัดที่ค้างในบัฟเฟอร์จะหายไปทั้งก้อน
 * ซึ่งเคยทำให้บอกไม่ได้เลยว่ามันไปตายที่ใบไหน
 */
function say(line: string) {
  process.stdout.write(`${line}\n`);
}

/** อ่านค่าตัวเลขจากธง เช่น --delivered=6 ตอนไล่บั๊กจะได้ไม่ต้องรอรอบเต็ม */
function flag(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  const n = hit ? Number(hit.slice(name.length + 1)) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const CUSTOMERS = ['somchai', 'nid', 'ploy', 'wut', 'fah'];
const RIDERS = ['rider_ann', 'rider_som', 'rider_kai'];

/**
 * จำนวนใบที่ส่งถึงแล้วในหน้าต่างเจ็ดวัน มากพอให้ค่ากลางและอัตราต่าง ๆ นิ่ง
 * เคยตั้งไว้ 56 แต่ใบหนึ่งกินเวลา 20-35 วินาที (หกคำขอ HTTP บวกรอรอบจ่ายงาน)
 * รวมแล้วเกินครึ่งชั่วโมงต่อรอบ ยาวเกินไปสำหรับงานที่ต้องรันเองทุกคืนโดยไม่มีคนดู
 */
const DELIVERED = flag('--delivered', 36);
/** ยิงพร้อมกันได้เฉพาะขั้นที่แต่ละใบไม่ยุ่งกัน ไม่ใช่ขั้นเดินสถานะ */
const PARALLEL = 6;
/** ต่ำกว่านี้ถือว่าข้อมูลบางเกินกว่าจะเอาไปคำนวณตัวเลขใน §8 ได้ */
const MIN_SUCCESS_RATE = 0.8;
/** ยกเลิกไม่กี่ใบ ให้จอเคสกับอัตราปฏิเสธมีของให้ดู โดยยังไม่ทำให้ตัวเลขหลุดเกณฑ์ §8 */
const CANCELLED = 3;
const DAYS = 7;

/**
 * ร้านของบัญชีสาธิตฝั่งร้าน สุ่มเท่ากันทั้ง 19 ร้านแล้วร้านนี้จะได้ราวสามใบ
 * จอยอดขายกับจอถอนเงินของร้านจึงว่างจนอ่านเหมือนยังทำไม่เสร็จ ทั้งที่ทั้งฐานมีของครบ
 */
const DEMO_SHOP = 'ครัวมาลี';
const DEMO_SHOP_SHARE = 0.35;

/** ผลลัพธ์ต้องเหมือนเดิมทุกครั้งที่รัน ไม่งั้นเทียบก่อนหลังไม่ได้ */
let seed = 20260901;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);

/** ร้านสาธิตได้ส่วนแบ่งที่ตั้งไว้ ที่เหลือสุ่มเท่ากันตามเดิม */
function pickShop(choices: any[]): any {
  const demo = choices.find((r: any) => r.name === DEMO_SHOP);
  if (demo && rnd() < DEMO_SHOP_SHARE) return demo;
  return pick(choices);
}

type Res = { status: number; body: any };
type Placed = { id: string; at: Date; cancelled: boolean; rider?: string; customerToken?: string };

async function call(method: string, path: string, body?: unknown, token?: string): Promise<Res> {
  const res = await withRetry(() => fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
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
  return expect(`ล็อกอิน ${username}`,
    await call('POST', '/auth/login', { identifier: username, password: PASSWORD })).token as string;
}

/** เวลาที่คนสั่งอาหารจริง กระจุกที่มื้อกลางวันกับมื้อเย็น ไม่ใช่เกลี่ยเท่ากันทั้งวัน */
function orderedAt(now: Date, i: number, total: number): Date {
  const day = Math.floor((i / total) * DAYS);
  const lunch = rnd() < 0.45;
  const hour = lunch ? between(11, 13.5) : between(17, 20.5);
  const at = new Date(now);
  at.setDate(at.getDate() - (DAYS - 1 - day));
  at.setHours(Math.floor(hour), Math.floor((hour % 1) * 60), Math.floor(rnd() * 60), 0);
  return at;
}

async function main() {
  const client = createScriptClient();
  const tokens = new Map<string, string>();
  for (const u of [...CUSTOMERS, ...RIDERS, 'admin_root']) tokens.set(u, await login(u));

  const existing = await client<{ n: number }[]>`
    select count(*)::int n from orders where created_at < now() - interval '12 hours'`;
  if ((existing[0]?.n ?? 0) > 0 && !process.argv.includes('--force')) {
    console.log(`มีประวัติย้อนหลังอยู่แล้ว ${existing[0]!.n} ใบ ไม่ทำอะไรต่อ`);
    await client.end();
    return;
  }

  /**
   * ร้านที่ลูกค้าแต่ละคน สั่งได้จริง ไม่ใช่ร้านทั้งหมดในฐาน
   * เซิร์ฟเวอร์ตัดร้านที่ไกลเกินรัศมีส่งออกให้แล้ว หยิบจากรายการนี้จึงไม่โดนปฏิเสธกลางคัน
   */
  const nearby = new Map<string, any[]>();
  for (const u of CUSTOMERS) {
    nearby.set(u, expect(`ร้านใกล้ ${u}`, await call('GET', '/catalog/restaurants', undefined, tokens.get(u)!))
      .filter((r: any) => r.isOpen));
  }
  const reachable = [...new Set([...nearby.values()].flat().map((r: any) => r.id))];
  if (reachable.length === 0) throw new Error('ไม่มีร้านที่เปิดและอยู่ในระยะส่ง ต้องรัน db:seed ก่อน');

  /** จานที่ยังขายอยู่ของแต่ละร้าน พร้อมตัวเลือกที่บังคับต้องเลือก */
  const menus = new Map<string, any[]>();
  for (const id of reachable) {
    menus.set(id, expect('อ่านเมนู', await call('GET', `/catalog/restaurants/${id}/menu`)));
  }

  const now = new Date();
  const total = DELIVERED + CANCELLED;

  /**
   * เลือกของให้ครบทุกใบก่อน แล้วค่อยยิง
   * rnd() เป็นลำดับเดียวกันทั้งสคริปต์ ถ้าเรียกมันระหว่างยิงพร้อมกัน ผลแต่ละรอบจะไม่เหมือนเดิม
   */
  const drafts = [];
  for (let i = 0; i < total; i += 1) {
    const customer = pick(CUSTOMERS);
    const choices = nearby.get(customer) ?? [];
    if (choices.length === 0) continue;
    const shop = pickShop(choices);
    const open = (menus.get(shop.id) ?? []).filter((m: any) => m.isAvailable);
    if (open.length === 0) continue;
    const dish = open[Math.floor(rnd() * open.length)]!;
    const required = (dish.optionGroups ?? []).filter((g: any) => g.minSelect > 0);

    drafts.push({
      customer,
      at: orderedAt(now, i, total),
      cancelled: i >= DELIVERED,
      body: {
        restaurantId: shop.id,
        items: [{
          menuItemId: dish.id,
          choiceIds: required.map((g: any) => g.choices[0].id),
          quantity: rnd() < 0.25 ? 2 : 1,
        }],
        paymentMethod: rnd() < 0.72 ? 'promptpay' : 'cash',
      },
    });
  }

  // แต่ละใบไม่ยุ่งกันเลยตอนสั่ง ยิงเรียงทีละใบเสียเวลาเปล่าเป็นนาที
  const results = await mapLimit<typeof drafts[number], Placed | null>(drafts, PARALLEL, async (d, i) => {
    const res = await call('POST', '/orders', d.body, tokens.get(d.customer)!);
    if (![200, 201].includes(res.status)) {
      console.log(`  สั่งใบที่ ${i + 1} ไม่ผ่าน — ${res.status} ${JSON.stringify(res.body)}`);
      return null;
    }
    return { id: res.body.id, at: d.at, cancelled: d.cancelled, customerToken: tokens.get(d.customer)! };
  });
  const placed: Placed[] = results.filter((r): r is Placed => r !== null);

  console.log(`สั่งแล้ว ${placed.length}/${drafts.length} ใบ กำลังเดินสถานะ`);

  /**
   * เดินผ่าน HTTP ทุกก้าว ไม่แตะสถานะด้วย SQL ตรง ๆ
   * เพราะ ledger ลงในทรานแซกชันเดียวกับตอนเปลี่ยนเป็น delivered ข้ามขั้นแล้วบัญชีไม่ลงตัว
   * แอดมินเป็นคนกดแทนร้านได้ตามสิทธิ์ที่ §6.3 ให้ไว้ จึงไม่ต้องล็อกอินเจ้าของร้านทีละคน
   */
  const admin = tokens.get('admin_root')!;

  for (const o of placed.filter((x) => x.cancelled)) {
    expect('ทีมงานยกเลิก', await call('PATCH', `/orders/${o.id}/status`,
      { status: 'cancelled', reason: 'other' }, admin));
  }

  /**
   * เครื่องจ่ายงานเลือกไรเดอร์ที่ออนไลน์และคะแนนดีที่สุดเอง เราสั่งไม่ได้ว่าจะให้ใคร (§6.3)
   * จึงเปิดทีละคนแล้วปิดที่เหลือ ใบในรอบนั้นจึงตกไปที่คนที่ตั้งใจไว้แน่นอน
   */
  const queue = placed.filter((x) => !x.cancelled);
  let failed = 0;
  let walked = 0;
  for (const [n, rider] of RIDERS.entries()) {
    const riderToken = tokens.get(rider)!;
    for (const other of RIDERS) {
      if (other !== rider) {
        expect('ปิดรับงาน', await call('POST', '/rider/online', { isOnline: false }, tokens.get(other)!));
      }
    }
    expect('เปิดรับงาน',
      await call('POST', '/rider/online', { isOnline: true, lat: 13.7805, lng: 100.5435 }, riderToken));

    const mine = queue.filter((_, i) => i % RIDERS.length === n);
    const out = await runQueue(mine, {
      walk: async (o) => {
        walked += 1;
        // เงียบยาวสิบกว่านาทีระหว่างสองบรรทัดทำให้บอกไม่ได้ว่าตายที่ใบไหนตอนมันหายไปเฉย ๆ
        say(`  [${walked}/${queue.length}] ${o.id.slice(0, 8)} → ${rider}`);
        await walk(o, rider, riderToken, admin);
      },
      cancel: async (o) => {
        expect('ยกเลิกใบที่เดินไม่จบ',
          await call('PATCH', `/orders/${o.id}/status`, { status: 'cancelled', reason: 'other' }, admin));
      },
      log: say,
    });
    failed += out.failed;
  }

  for (const rider of RIDERS) {
    expect('ปิดรับงาน', await call('POST', '/rider/online', { isOnline: false }, tokens.get(rider)!));
  }

  async function offerFor(orderId: string) {
    const [offer] = await client<{ id: string }[]>`
      select id from dispatch_offers where order_id = ${orderId} and outcome = 'pending' limit 1`;
    return offer;
  }

  /**
   * รอรอบจ่ายงานอัตโนมัติก่อน แล้วค่อยใช้ทางแทรกมือของแอดมินเป็นตาข่าย (§6.3)
   * รอบอัตโนมัติข้ามใบที่ร้านอยู่ไกลจากจุดที่ไรเดอร์ยืนอยู่ ซึ่งในฐานสาธิตมีร้านไกลถึง 14 กม.
   * ใบเสนอหมดอายุใน 15 วินาที ถามถี่หน่อยจะได้รับทัน
   */
  async function waitForOffer(orderId: string, admin: string) {
    for (let i = 0; i < 8; i += 1) {
      if (await offerFor(orderId)) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    // ชนกับรอบอัตโนมัติได้ ปล่อยให้พลาดแล้วไปเช็คผลจริงในฐานแทนการเชื่อรหัสตอบกลับ
    await call('POST', `/admin/dispatch/orders/${orderId}`, undefined, admin);
    for (let i = 0; i < 12; i += 1) {
      if (await offerFor(orderId)) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`ไม่มีใครรับใบ ${orderId} ทั้งรอบอัตโนมัติและการสั่งจ่ายเอง`);
  }

  async function walk(o: Placed, rider: string, riderToken: string, admin: string) {
    expect('ร้านรับ', await call('PATCH', `/orders/${o.id}/status`, { status: 'accepted' }, admin));
    /**
     * ปล่อยให้รอบจ่ายงานของเซิร์ฟเวอร์เสนอเอง (§6.3 เดินทุก 3 วินาที)
     * เคยสั่ง forceDispatch เองแล้วชนกับรอบอัตโนมัติจนคีย์ (order_id, rider_id) ซ้ำ
     * และการรอแบบนี้ทำให้ประวัติที่ได้เป็นงานที่ ระบบจ่ายเอง จริง ๆ ตรงกับที่จอแอดมินวัด
     */
    await waitForOffer(o.id, admin);
    expect('ไรเดอร์รับงาน', await call('POST', `/rider/jobs/${o.id}/accept`, undefined, riderToken));
    expect('ร้านเริ่มทำ', await call('PATCH', `/orders/${o.id}/status`, { status: 'preparing' }, admin));
    expect('ไรเดอร์รับของ', await call('PATCH', `/orders/${o.id}/status`, { status: 'picked_up' }, riderToken));

    /**
     * ปิดงานต้องมีทั้งรูปและรหัสสี่หลัก (design R11)
     * รหัสเป็นของลูกค้าเท่านั้น API ไม่เปิดให้ฝั่งอื่นอ่าน สคริปต์ seed จึงหยิบจากฐานตรง ๆ
     */
    const [row] = await client<{ pin: string }[]>`
      select delivery_pin as pin from orders where id = ${o.id}`;
    const proof = expect('ขอที่วางรูปยืนยันส่ง',
      await call('POST', '/storage/delivery-proof/sign-upload', { orderId: o.id, ext: 'jpg' }, riderToken));
    expect('ไรเดอร์ปิดงาน', await call('PATCH', `/orders/${o.id}/status`, {
      status: 'delivered', deliveryPin: row?.pin, photoPath: proof.path,
    }, riderToken));

    o.rider = rider;
  }


  const done = placed.filter((o) => !o.cancelled).length;
  console.log(`เดินสถานะครบ ส่งถึง ${done}/${DELIVERED} ใบ${failed > 0 ? ` (พลาด ${failed})` : ''}`);

  /**
   * ของน้อยเกินไปทำให้ค่ากลางกับอัตราต่าง ๆ อ่านเพี้ยน ซึ่งคือปัญหาที่สคริปต์นี้เกิดมาเพื่อแก้
   * ล้มตรงนี้บอกได้ว่าได้มาเท่าไร ต่างจากล้มกลางทางเพราะใบที่ 41 สะดุด
   */
  assertEnough(done, DELIVERED, MIN_SUCCESS_RATE);

  console.log('กำลังใส่รีวิว');
  await reviews(client, placed, tokens);

  await refundCases(placed, tokens.get('admin_root')!);

  console.log('กำลังย้อนเวลา');
  await backdate(client, placed);
  await sessions(client, placed);

  await summarise(client);
  await client.end();
}

/**
 * ร้านส่วนใหญ่ต้องมีดาว ไม่ใช่ null ทั้งหน้าแรก
 * เคยรีวิวหกในสิบใบตอนที่มี 56 ใบ พอลดเหลือ 36 ใบและถ่วงให้ครัวมาลีหนึ่งในสาม
 * ร้านที่ได้ดาวเหลือแค่ 9 จาก 22 หน้าแรกจึงขึ้นสถานะแทนคะแนนเป็นส่วนใหญ่
 * คะแนนเอียงไปทางสูงเหมือนของจริง คนไม่พอใจส่วนน้อยถึงจะมาให้สองดาว
 */
const REVIEW_RATE = 0.9;
async function reviews(
  client: ReturnType<typeof createScriptClient>,
  placed: Placed[],
  tokens: Map<string, string>,
) {
  const COMMENTS = [
    'อาหารร้อน ส่งเร็วกว่าที่บอกไว้',
    'รสชาติเหมือนกินที่ร้าน แพ็กมาดีไม่หก',
    'ไรเดอร์โทรบอกก่อนถึง ชอบตรงนี้',
    'อร่อยดี แต่รอนานกว่าที่แจ้งไว้นิดหน่อย',
    'สั่งประจำ ไม่เคยพลาด',
    '',
  ];
  // เลือกคะแนนให้ครบก่อนเหมือนตอนสั่ง เพราะ rnd() ใช้ลำดับเดียวกันทั้งสคริปต์
  const drafts = [];
  for (const o of placed) {
    if (o.cancelled || !o.customerToken || rnd() > REVIEW_RATE) continue;
    const good = rnd() < 0.82;
    drafts.push({
      token: o.customerToken,
      id: o.id,
      body: {
        restaurantRating: good ? (rnd() < 0.6 ? 5 : 4) : (rnd() < 0.5 ? 3 : 2),
        riderRating: good ? 5 : 4,
        comment: pick(COMMENTS),
      },
    });
  }

  const results = await mapLimit(drafts, PARALLEL, async (d) => {
    const res = await call('POST', `/orders/${d.id}/review`, d.body, d.token);
    return [200, 201].includes(res.status);
  });
  console.log(`รีวิว ${results.filter(Boolean).length} ใบ`);
}

/**
 * เรื่องแจ้งปัญหา สองใบทิ้งไว้ให้แอดมินตัดสิน หนึ่งใบอนุมัติไปแล้ว
 * ไม่มีอันนี้ คิวคืนเงินของแอดมินจะว่างเปล่าและอัตราคืนเงินใน §8 จะเป็น 0.0% ตลอด
 * ซึ่งอ่านเหมือนจอนั้นยังต่อไม่เสร็จ ทั้งที่เส้นทางทำงานครบ
 */
async function refundCases(placed: Placed[], admin: string) {
  const REASONS = ['missing_item', 'food_quality', 'wrong_item'] as const;
  const DETAILS = [
    'สั่งไข่ดาวเพิ่มแต่ไม่ได้มาด้วย',
    'ข้าวเละกว่าปกติมาก กินไม่ได้ทั้งกล่อง',
    'ได้ผัดกะเพราหมูแทนที่จะเป็นไก่ที่สั่งไว้',
  ];

  const targets = placed.filter((o) => !o.cancelled && o.customerToken).slice(0, REASONS.length);
  const opened: string[] = [];
  for (const [i, o] of targets.entries()) {
    const res = await call('POST', '/refunds', {
      orderId: o.id,
      reason: REASONS[i],
      detail: DETAILS[i],
      hasPhoto: false,
    }, o.customerToken!);
    if ([200, 201].includes(res.status)) opened.push(res.body.id);
  }

  // ใบแรกให้จบวงจนถึงเงินคืนออกจริง ที่เหลือค้างไว้เป็นคิวให้กดเล่น
  let approved = 0;
  if (opened[0]) {
    const res = await call('POST', `/admin/refunds/${opened[0]}`, { approve: true, fault: 'restaurant' }, admin);
    if (res.status === 200) approved = 1;
  }
  console.log(`เรื่องแจ้งปัญหา ${opened.length} ใบ · อนุมัติแล้ว ${approved} ใบ`);
}

/** ตัวเลขที่จอแอดมินจะโชว์ ตรวจตรงนี้เลยว่าอ่านแล้วเป็นไปได้ไหม */
async function summarise(client: ReturnType<typeof createScriptClient>) {
  const [row] = await client<{
    orders: number; delivered: number; hours: number; median: number | null;
    on_time: number; rated: number;
  }[]>`
    select
      (select count(*) from orders where created_at > now() - interval '7 days')::int as orders,
      (select count(*) from orders where status = 'delivered'
        and created_at > now() - interval '7 days')::int as delivered,
      (select coalesce(sum(extract(epoch from (offline_at - online_at))) / 3600.0, 0)
        from rider_sessions)::float8 as hours,
      (select percentile_cont(0.5) within group (
        order by extract(epoch from (delivered_at - created_at)) / 60)
        from orders where status = 'delivered')::float8 as median,
      (select count(*) from orders where status = 'delivered'
        and delivered_at <= created_at + interval '30 minutes')::int as on_time,
      (select count(distinct restaurant_id) from reviews)::int as rated`;
  if (!row) return;
  console.log([
    `ออเดอร์ 7 วัน ${row.orders} · ส่งถึง ${row.delivered}`,
    `ออเดอร์ต่อชั่วโมงต่อไรเดอร์ ${(row.delivered / row.hours).toFixed(2)} (เป้า ≥ 3.0)`,
    `ค่ากลางเวลาส่ง ${Math.round(row.median ?? 0)} นาที`,
    `ส่งตรงเวลา ${((row.on_time / row.delivered) * 100).toFixed(0)}% (เป้า > 90%)`,
    `ร้านที่มีรีวิว ${row.rated}`,
  ].join('\n'));
}

/**
 * ย้อนเวลาให้ทุกก้าวของออเดอร์ เวลาที่ใช้จริงต้องดูเป็นไปได้
 * ร้านรับใน 1–3 นาที ทำ 6–14 นาที ส่ง 6–11 นาที รวมแล้วส่วนใหญ่จบใน 30 นาทีตามเป้า §8
 *
 * ledger ย้อนไม่ได้ ฐานมีทริกเกอร์ห้าม UPDATE แถวเดิมเพื่อกันการแก้ยอดย้อนหลัง (§6.2)
 * ทุกรายการจึงลงวันที่วันนี้ ซึ่งยังอยู่ในหน้าต่างเจ็ดวันที่จอแอดมินใช้คำนวณอยู่ดี
 */
async function backdate(client: ReturnType<typeof createScriptClient>, placed: Placed[]) {
  for (const o of placed) {
    const created = o.at;
    if (o.cancelled) {
      await client`update orders set created_at = ${created},
        cancelled_at = ${new Date(created.getTime() + between(3, 9) * 60000)} where id = ${o.id}`;
      continue;
    }
    const accepted = new Date(created.getTime() + between(1, 3) * 60000);
    const picked = new Date(accepted.getTime() + between(6, 14) * 60000);
    // ใบปกติจบใน 30 นาทีตามเป้า §8 อีกไม่ถึงหนึ่งในสิบหลุด ของจริงไม่มีทางตรงเวลาร้อยเปอร์เซ็นต์
    const late = rnd() < 0.08;
    const delivered = new Date(picked.getTime() + between(6, late ? 28 : 11) * 60000);

    await client`update orders set
      created_at = ${created}, accepted_at = ${accepted},
      picked_up_at = ${picked}, delivered_at = ${delivered},
      paid_at = ${delivered}
      where id = ${o.id}`;
    // หมดอายุ 15 วินาทีหลังเสนอ (§6.3) ต้องขยับตามกัน ไม่งั้นชนเงื่อนไขของตาราง
    await client`update dispatch_offers set
      offered_at = ${accepted},
      expires_at = ${new Date(accepted.getTime() + 15000)},
      responded_at = ${new Date(accepted.getTime() + between(2, 9) * 1000)}
      where order_id = ${o.id}`;
  }
  console.log(`ย้อนเวลา ${placed.length} ใบ`);
}

/**
 * ชั่วโมงออนไลน์ของไรเดอร์ ตัวหารของ "ออเดอร์ต่อชั่วโมงต่อไรเดอร์" มาจากตารางนี้ ไม่ใช่จากออเดอร์
 * ตั้งกะให้คลุมช่วงที่มีงานจริง แล้วค่าที่ได้จะอยู่ราว 3 ใบต่อชั่วโมงตามเป้า §8
 */
async function sessions(client: ReturnType<typeof createScriptClient>, placed: Placed[]) {
  const delivered = placed.filter((o) => !o.cancelled);
  const zone = await client<{ id: string }[]>`select id from zones limit 1`;
  await client`delete from rider_sessions`;

  let rows = 0;
  for (let d = 0; d < DAYS; d += 1) {
    const day = new Date();
    day.setDate(day.getDate() - (DAYS - 1 - d));
    const onThisDay = delivered.filter((o) => o.at.getDate() === day.getDate()).length;
    if (onThisDay === 0) continue;

    // ชั่วโมงรวมทั้งวันของทุกคน = จำนวนใบ ÷ 3.2 แล้วหารเฉลี่ยกันไปตามหัว
    const hoursEach = onThisDay / 3.2 / RIDERS.length;
    for (const username of RIDERS) {
      for (const [startHour, span] of [[11, hoursEach * 0.45], [17.5, hoursEach * 0.55]] as const) {
        const online = new Date(day);
        online.setHours(Math.floor(startHour), Math.floor((startHour % 1) * 60) + RIDERS.indexOf(username) * 5, 0, 0);
        const offline = new Date(online.getTime() + span * 3600000);
        await client`insert into rider_sessions (account_id, zone_id, online_at, offline_at)
          values ((select id from accounts where username = ${username}), ${zone[0]?.id ?? null}, ${online}, ${offline})`;
        rows += 1;
      }
    }
  }
  console.log(`กะไรเดอร์ ${rows} ช่วง`);
}

/**
 * คอนเนกชันของ postgres.js ที่หลุดกลางคันโผล่มานอกสายโซ่ promise ได้
 * ไม่ดักไว้ process จะหายไปเงียบ ๆ ทิ้งฐานค้างครึ่งทางโดยไม่มีใครรู้ว่าเกิดอะไร (เคยเจอมาแล้ว)
 */
for (const signal of ['unhandledRejection', 'uncaughtException'] as const) {
  process.on(signal, (error: unknown) => {
    say(`ตายนอกสายโซ่ (${signal}): ${(error as Error)?.stack ?? String(error)}`);
    process.exit(1);
  });
}

main().catch((error) => {
  say(`สร้างประวัติสาธิตไม่สำเร็จ: ${(error as Error).message}`);
  process.exit(1);
});
