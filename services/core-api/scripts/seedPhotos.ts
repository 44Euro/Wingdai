import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createScriptClient } from '../src/db/client';

/**
 * รูปหน้าร้านกับรูปจานของฐานสาธิต หยิบจาก Wikimedia Commons เพราะค้นด้วยชื่อจานได้ตรง
 * และบอกสัญญาอนุญาตกับผู้ถ่ายมาให้ครบ ต่างจากคลังรูปที่ต้องเดา id เอาเอง
 *
 * ดาวน์โหลดครั้งเดียวแล้วอัปเข้าบักเก็ตของเราเลย เดโมจะได้ไม่ผูกกับโฮสต์ข้างนอกตอนใช้งานจริง
 * รันซ้ำได้ ของที่มีอยู่แล้วจะถูกข้าม ยกเว้นสั่ง --force
 */
const UA = 'wingdai-demo-seed/1.0 (portfolio project)';
const API = 'https://commons.wikimedia.org/w/api.php';

/** เอาเฉพาะสัญญาที่ให้ใช้ต่อได้ ขอแค่ให้เครดิต ซึ่งเราเขียนลง docs/photo-credits.md */
const ALLOWED_LICENSE = /^(CC BY|CC BY-SA|CC0|Public domain)/i;

/** คำค้นภาษาอังกฤษต่อร้าน คีย์เป็นชื่อร้านไทยตรง ๆ เพราะฐานเก็บชื่อ ไม่ได้เก็บคีย์ของ seed */
const SHOP_QUERY: Record<string, string> = {
  'ข้าวมันไก่ประตูน้ำ': 'Hainanese chicken rice Thailand',
  'ก๋วยเตี๋ยวเนื้อตุ๋นอารีย์': 'Thai beef noodle soup',
  'ตำมั่วสาขาอารีย์': 'Som tam papaya salad',
  'ชานมไข่มุกอารีย์': 'Bubble tea milk',
  'บิงซูหวานเย็น': 'Bingsu shaved ice dessert',
  'ข้าวหมูแดงเจ๊หมวย': 'Char siu red pork rice',
  'บะหมี่เกี๊ยวกุ้งสะพานควาย': 'Bamee egg noodle wonton',
  'ส้มตำนัวนัว': 'Papaya salad Laos',
  'กาแฟสดอารีย์โรสต์': 'Iced coffee glass cafe',
  'โรตีชาชักพหลโยธิน': 'Roti pancake street food Thailand',
  'ข้าวขาหมูตรอกซุง': 'Khao kha moo',
  'ก๋วยเตี๋ยวต้มยำเจ๊นิด': 'Tom yum noodle soup',
  'ข้าวแกงป้าอ้วน': 'Thai curry rice shop',
  'น้ำปั่นเจ๊แดง': 'Thai fruit smoothie drink',
  'ขนมครกโบราณ': 'Kanom krok coconut pancake',
  'ส้มตำป้านวล': 'Thai papaya salad plate',
  'ข้าวต้มสีลม': 'Rice porridge congee Thailand',
  'ราเมนทองหล่อ': 'Ramen noodle bowl',
  'ส้มตำบางนา': 'Papaya salad crab',
  'ก๋วยเตี๋ยวเรือ': 'Thai boat noodle',
  'ครัวมาลี': 'Thai food street kitchen',
  'ส้มตำแซ่บนัว': 'Isan som tam grilled chicken',
  'ร้านรออนุมัติ': 'Thai rice dish plate',
};

/** ร้านหรือจานที่ไม่ได้อยู่ในสองตารางข้างบน อย่างน้อยต้องได้รูปที่ตรงหมวด ไม่ใช่กล่องเปล่า */
const CUISINE_QUERY: Record<string, string> = {
  rice: 'Thai rice dish plate',
  noodle: 'Thai noodle soup bowl',
  somtam: 'Som tam green papaya salad',
  drink: 'Thai iced drink glass',
  dessert: 'Thai dessert sweet',
};

/** คำค้นต่อชื่อจาน ชื่อจานซ้ำกันหลายร้าน จึงใช้รูปชุดเดียวกัน */
const DISH_QUERY: Record<string, string> = {
  'ข้าวกะเพราหมู': 'Pad kaphrao basil pork rice',
  'ข้าวผัดหมู': 'Thai fried rice pork',
  'ข้าวไข่เจียว': 'Khai jiao',
  'ก๋วยเตี๋ยวหมูน้ำใส': 'Thai pork noodle soup clear broth',
  'บะหมี่แห้ง': 'Egg noodles Thailand',
  'เกาเหลารวมมิตร': 'Tom jued clear soup Thai',
  'ส้มตำไทย': 'Som tam Thai green papaya salad',
  'ไก่ย่าง': 'Grilled chicken gai yang Thai',
  'ข้าวเหนียว': 'Sticky rice bamboo basket Thai',
  'ชาไทยเย็น': 'Thai iced tea cha yen',
  'อเมริกาโน่เย็น': 'Iced americano coffee',
  'น้ำส้มคั้นสด': 'Fresh orange juice glass',
  'บัวลอยไข่หวาน': 'Bua loi Thai dessert',
  'ไอศกรีมกะทิ': 'Coconut ice cream Thai',
  'ขนมครก': 'Kanom krok coconut pancake Thai',
  'ก๋วยเตี๋ยวเรือหมู': 'Thai boat noodle pork',
  'เกาเหลา': 'Thai clear soup bowl',
  'ข้าวกะเพราหมูสับ': 'Pad kaphrao minced pork rice',
  'ข้าวผัดกุ้ง': 'Thai shrimp fried rice',
  'ข้าวมันไก่': 'Hainanese chicken rice plate',
  'ข้าวหมูทอด': 'Fried pork rice Thai',
  'น้ำมะพร้าว': 'Coconut water drink',
};

type Picked = { title: string; url: string; artist: string; license: string };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** ค้นรูปที่ใช้ได้รูปแรก คืน null เมื่อไม่มีอันไหนผ่านเกณฑ์สัญญาอนุญาต */
const used = new Set<string>();

async function findPhoto(query: string): Promise<Picked | null> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiextmetadatafilter: 'LicenseShortName|Artist',
    iiurlwidth: '1000',
    format: 'json',
  });

  const res = await getWithRetry(`${API}?${params}`);
  const body = (await res.json()) as any;

  const pages: any[] = Object.values(body?.query?.pages ?? {});
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? '')) continue;
    const license = info.extmetadata?.LicenseShortName?.value ?? '';
    if (!ALLOWED_LICENSE.test(license)) continue;
    const title = String(page.title).replace(/^File:/, '');
    if (used.has(title)) continue;
    used.add(title);
    return {
      title,
      url: info.thumburl,
      artist: stripHtml(info.extmetadata?.Artist?.value ?? 'ไม่ระบุ'),
      license,
    };
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Commons ตอบ 429 เมื่อยิงถี่ ถอยเป็นเท่าตัวแล้วลองใหม่ ไม่ใช่ล้มทั้งสคริปต์ */
async function getWithRetry(url: string, tries = 7): Promise<Response> {
  for (let i = 0; i < tries; i += 1) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) throw new Error(`เรียกไม่สำเร็จ (${res.status})`);
    await sleep(1500 * 2 ** i);
  }
  throw new Error('เรียกไม่สำเร็จ ลองครบจำนวนแล้วยังโดนจำกัดอัตราอยู่');
}

async function download(url: string): Promise<Buffer> {
  const res = await getWithRetry(url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error(`ไฟล์เล็กผิดปกติ ${buf.length} ไบต์`);
  return buf;
}

/** ชื่อไทยเป็นเส้นทางไฟล์ไม่ได้ ย่อยเป็นแฮชสั้น ๆ ที่ได้ค่าเดิมทุกครั้ง */
const pathFor = (prefix: 'shop' | 'dish', name: string) =>
  `catalog/${prefix}-${createHash('sha1').update(name).digest('hex').slice(0, 10)}.jpg`;

/** รายชื่อ ชื่อ → เส้นทางในบักเก็ต ให้โหมด --relink ใช้ตอนรีเซ็ตรายคืน */
async function writeManifest(client: ReturnType<typeof createScriptClient>) {
  const shops = await client<{ name: string; p: string }[]>`
    select name, storefront_photo_path as p from restaurants
    where storefront_photo_path is not null order by name`;
  const dishes = await client<{ name: string; p: string }[]>`
    select name, max(photo_path) as p from menu_items
    where photo_path is not null group by name order by name`;
  const map = Object.fromEntries([...shops, ...dishes].map((r) => [r.name, r.p]));
  await writeFile(MANIFEST, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`บันทึกรายชื่อรูป ${Object.keys(map).length} รายการ`);
}

/**
 * เครดิตผู้ถ่ายกับสัญญาอนุญาต ทุกรูปที่ Commons ให้มาต้องให้เครดิต
 * รวมกับของเดิมในไฟล์เสมอ เพราะการรันรอบหนึ่งอัปแค่รูปที่ยังขาด ไม่ใช่ทั้งชุด
 */
async function writeCredits(picked: Picked[]) {
  const target = resolve(__dirname, '../../../docs/photo-credits.md');
  const existing = await readFile(target, 'utf8').catch(() => '');
  const byTitle = new Map<string, string>();
  for (const line of existing.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length === 5 && cells[1] && cells[1] !== '---' && cells[1] !== 'ไฟล์ต้นทาง') {
      byTitle.set(cells[1], line.trim());
    }
  }
  for (const p of picked) byTitle.set(p.title, `| ${p.title} | ${p.artist} | ${p.license} |`);

  const rows = [...byTitle.keys()].sort().map((t) => byTitle.get(t)!).join('\n');
  const doc = [
    '# ที่มาของรูปในฐานสาธิต',
    '',
    'รูปอาหารและหน้าร้านทั้งหมดมาจาก Wikimedia Commons ดาวน์โหลดครั้งเดียวแล้วเก็บไว้ในบักเก็ตของโปรเจกต์เอง',
    'สร้างไฟล์นี้อัตโนมัติจาก `npm run db:photos`',
    '',
    '| ไฟล์ต้นทาง | ผู้ถ่าย | สัญญาอนุญาต |',
    '| --- | --- | --- |',
    rows,
    '',
  ].join('\n');
  await writeFile(target, doc);
}

const MANIFEST = resolve(__dirname, 'photo-manifest.json');

/**
 * ต่อเส้นทางรูปกลับเข้าฐานโดยไม่แตะเน็ตเลย
 * ไฟล์อยู่ในบักเก็ตอยู่แล้ว truncate ลบแค่คอลัมน์ในฐาน ไม่ได้ลบไฟล์
 * รอบรีเซ็ตรายคืนจึงใช้โหมดนี้ ไม่ต้องไปกวน Commons ทุกคืนและไม่ต้องใช้กุญแจ Supabase
 */
async function relink() {
  const manifest: Record<string, string> = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const client = createScriptClient();
  let shops = 0;
  let dishes = 0;
  for (const [name, path] of Object.entries(manifest)) {
    const kind = path.includes('/shop-') ? 'shop' : 'dish';
    if (kind === 'shop') {
      const r = await client`update restaurants set storefront_photo_path = ${path}
        where name = ${name} returning id`;
      shops += r.length;
    } else {
      const r = await client`update menu_items set photo_path = ${path}
        where name = ${name} returning id`;
      dishes += r.length;
    }
  }
  await client.end();
  console.log(`ต่อเส้นทางรูปกลับเข้าฐาน ร้าน ${shops} · จาน ${dishes}`);
}

async function main() {
  if (process.argv.includes('--relink')) return relink();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY');

  const force = process.argv.includes('--force');
  const storage = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const client = createScriptClient();

  const shops = await client<{ id: string; name: string; cuisine: string; photo: string | null }[]>`
    select id, name, cuisine, storefront_photo_path as photo from restaurants order by name`;
  const dishes = await client<{ name: string; category: string; photo: string | null }[]>`
    select name, category, max(photo_path) as photo from menu_items
    group by name, category order by name`;

  const credits: Picked[] = [];

  /** อัปรูปหนึ่งใบแล้วคืนเส้นทางในบักเก็ต ข้ามให้เมื่อมีอยู่แล้ว */
  async function place(path: string, query: string, label: string): Promise<string | null> {
    const picked = await findPhoto(query);
    if (!picked) {
      console.log(`  ข้าม ${label} — ไม่เจอรูปที่สัญญาอนุญาตใช้ได้`);
      return null;
    }
    const bytes = await download(picked.url);
    const { error } = await storage.storage
      .from('public-media')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`อัป ${path} ไม่สำเร็จ: ${error.message}`);
    credits.push(picked);
    console.log(`  ${label} ← ${picked.title} (${picked.license})`);
    await sleep(1200);
    return path;
  }

  console.log(`ร้าน ${shops.length} · จาน ${dishes.length}`);

  for (const shop of shops) {
    const query = SHOP_QUERY[shop.name] ?? CUISINE_QUERY[shop.cuisine];
    if (!query) { console.log(`  ข้าม ${shop.name} — ไม่มีคำค้น`); continue; }
    if (shop.photo && !force) { console.log(`  มีรูปแล้ว ${shop.name}`); continue; }
    const path = await place(pathFor('shop', shop.name), query, shop.name);
    if (path) await client`update restaurants set storefront_photo_path = ${path} where id = ${shop.id}`;
  }

  for (const dish of dishes) {
    const query = DISH_QUERY[dish.name] ?? CUISINE_QUERY[dish.category];
    if (!query) { console.log(`  ข้าม ${dish.name} — ไม่มีคำค้น`); continue; }
    if (dish.photo && !force) { console.log(`  มีรูปแล้ว ${dish.name}`); continue; }
    const path = await place(pathFor('dish', dish.name), query, dish.name);
    if (path) await client`update menu_items set photo_path = ${path} where name = ${dish.name}`;
  }

  await writeCredits(credits);
  await writeManifest(client);
  await client.end();
  console.log(`\nอัปรูป ${credits.length} ใบ · เครดิตอยู่ที่ docs/photo-credits.md`);
}

main().catch((error) => {
  console.error('ใส่รูปไม่สำเร็จ:', (error as Error).message);
  process.exit(1);
});
