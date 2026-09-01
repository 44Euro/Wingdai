import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * expo export วางฟอนต์ไว้ที่ `assets/node_modules/...` ตามที่มันถูก resolve มา
 * แต่ Vercel ตัดทุก path ที่มีคำว่า node_modules ทิ้งตั้งแต่ตอนอัป และ `!` ใน .vercelignore
 * ก็ปลุกไฟล์ในโฟลเดอร์ที่ถูกตัดทั้งก้อนกลับมาไม่ได้ ฟอนต์จึง 404 แล้วตัวอักษรละตินตกไปใช้ฟอนต์สำรอง
 * ทางแก้คือย้ายออกจากชื่อนั้น แล้วแก้ path ที่บันเดิลอ้างถึงให้ตรงกัน
 */
const DIST = new URL('../dist/', import.meta.url).pathname;
const FROM = 'assets/node_modules/';
const TO = 'assets/vendor/';
const PATCHABLE = ['.js', '.css', '.json'];

/**
 * ผลลัพธ์ต้องเลี้ยงตัวเองได้ ถ้าวันหลังมีใครอัปโฟลเดอร์นี้ขึ้นโฮสต์แบบ prebuilt
 * `apps/mobile/vercel.json` จะไม่ถูกอ่านเลย และทุก path ที่ไม่ใช่ไฟล์จริงจะตก 404
 * ซึ่งกินทั้งลิงก์ร้าน/ออเดอร์ใน linking.ts และการกดรีเฟรชกลางแอป
 */
const ROUTING = { rewrites: [{ source: '/(.*)', destination: '/index.html' }] };

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function main() {
  const from = join(DIST, FROM);
  const to = join(DIST, TO);

  if (existsSync(from)) {
    if (existsSync(to)) throw new Error(`มีทั้ง ${FROM} และ ${TO} — ลบ dist แล้ว export ใหม่`);
    await rename(from, to);
  } else if (!existsSync(to)) {
    throw new Error(`ไม่เจอ ${FROM} — รัน expo export ก่อน`);
  }

  const files = await walk(DIST);

  let patched = 0;
  for (const file of files) {
    if (!PATCHABLE.some((ext) => file.endsWith(ext))) continue;
    const src = await readFile(file, 'utf8');
    if (!src.includes(FROM)) continue;
    await writeFile(file, src.split(FROM).join(TO));
    patched += 1;
  }

  await writeFile(join(DIST, 'vercel.json'), `${JSON.stringify(ROUTING, null, 2)}\n`);
  // `!assets/node_modules` ไม่เคยปลุกไฟล์กลับมาได้ ทิ้งไว้มีแต่จะหลอกคนอ่านว่าแก้แล้ว
  await rm(join(DIST, '.vercelignore'), { force: true });

  const stray = files
    .filter((f) => f.includes('node_modules'))
    .map((f) => relative(DIST, f));
  if (stray.length > 0) {
    throw new Error(`ยังเหลือไฟล์ใต้ node_modules ${stray.length} ไฟล์ เช่น ${stray[0]}`);
  }

  console.log(`ย้าย ${FROM} → ${TO} · แก้ path ${patched} ไฟล์ · เขียน vercel.json · ไม่เหลือ node_modules`);
}

main().catch((error) => {
  console.error('เตรียมไฟล์เว็บไม่สำเร็จ:', error.message);
  process.exit(1);
});
