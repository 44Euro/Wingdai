import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * expo export วางฟอนต์ไว้ที่ `assets/node_modules/...` ตามที่มันถูก resolve มา
 * แต่ Vercel ตัดทุก path ที่มีคำว่า node_modules ทิ้งตั้งแต่ตอนอัป และ `!` ใน .vercelignore
 * ก็ปลุกไฟล์ในโฟลเดอร์ที่ถูกตัดทั้งก้อนกลับมาไม่ได้ ฟอนต์จึง 404 แล้วตัวอักษรไทยตกไปใช้ฟอนต์สำรอง
 * ทางแก้คือย้ายออกจากชื่อนั้น แล้วแก้ path ที่บันเดิลอ้างถึงให้ตรงกัน
 */
const DIST = new URL('../dist/', import.meta.url).pathname;
const FROM = 'assets/node_modules/';
const TO = 'assets/vendor/';

async function jsFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFiles(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

async function main() {
  const from = join(DIST, FROM);
  const to = join(DIST, TO);

  if (!existsSync(from)) {
    if (existsSync(to)) return console.log('ย้ายไปแล้ว ไม่ต้องทำซ้ำ');
    throw new Error(`ไม่เจอ ${FROM} — รัน expo export ก่อน`);
  }

  await rename(from, to);

  let patched = 0;
  for (const file of await jsFiles(join(DIST, '_expo'))) {
    const src = await readFile(file, 'utf8');
    if (!src.includes(FROM)) continue;
    await writeFile(file, src.split(FROM).join(TO));
    patched += 1;
  }

  const left = (await readdir(join(DIST, 'assets'))).filter((n) => n === 'node_modules');
  console.log(`ย้าย ${FROM} → ${TO} · แก้บันเดิล ${patched} ไฟล์ · เหลือ node_modules ${left.length} โฟลเดอร์`);
}

main().catch((error) => {
  console.error('เตรียมไฟล์เว็บไม่สำเร็จ:', error.message);
  process.exit(1);
});
