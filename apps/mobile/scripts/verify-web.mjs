/**
 * ตรวจเว็บที่ deploy แล้วว่ายังใช้ได้จริง สามอย่างที่เคยพังเงียบ ๆ มาก่อน
 * เรียก: node scripts/verify-web.mjs https://wingdai.vercel.app
 */
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!base.startsWith('http')) {
  console.error('ต้องบอก URL ของเว็บ เช่น node scripts/verify-web.mjs https://wingdai.vercel.app');
  process.exit(1);
}

const results = [];

function check(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const index = await fetch(`${base}/`);
  const html = await index.text();
  const bundlePath = html.match(/_expo\/static\/js\/web\/[^"]+\.js/)?.[0];
  if (!bundlePath) throw new Error('หาบันเดิลใน index.html ไม่เจอ');

  const bundle = await (await fetch(`${base}/${bundlePath}`)).text();

  check(
    'บันเดิลไม่อ้าง path ที่มีคำว่า node_modules',
    !bundle.includes('assets/node_modules/'),
    bundlePath,
  );

  /** ฟอนต์คือไฟล์ที่ Vercel เคยตัดทิ้ง ตัวอักษรละตินตกไปเป็น serif เพราะข้อนี้ */
  const font = bundle.match(/assets\/vendor\/[^"]+\.ttf/)?.[0];
  if (!font) {
    check('บันเดิลชี้ฟอนต์ไปที่ assets/vendor', false, 'ไม่เจอ .ttf ใต้ assets/vendor เลย');
  } else {
    const res = await fetch(`${base}/${font}`);
    check('ฟอนต์โหลดได้', res.ok, `${res.status} ${font.split('/').pop()}`);
  }

  /** linking.ts แม็ป order/:orderId ไว้ และ QR ของร้านพิมพ์ลิงก์ restaurant/:id ให้ลูกค้าสแกน */
  for (const path of ['order/00000000-0000-0000-0000-000000000000', 'restaurant/x']) {
    const res = await fetch(`${base}/${path}`);
    const body = await res.text();
    check(`ลิงก์ลึก /${path} ไม่ตก 404`, res.ok && body.includes('<div id="root">'), String(res.status));
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} ข้อไม่ผ่าน — อย่าเพิ่งบอกว่า deploy เสร็จ`);
    process.exit(1);
  }
  console.log(`\nครบทั้ง ${results.length} ข้อ`);
}

main().catch((error) => {
  console.error('ตรวจไม่สำเร็จ:', error.message);
  process.exit(1);
});
