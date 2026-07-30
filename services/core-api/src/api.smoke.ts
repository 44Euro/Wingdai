import 'dotenv/config';
import { randomInt } from 'node:crypto';
import postgres from 'postgres';

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
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: 'require', onnotice: () => {} });
  try {
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
