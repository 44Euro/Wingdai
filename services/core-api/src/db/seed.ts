import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createScriptClient } from './client';
import { drizzle } from 'drizzle-orm/postgres-js';
import { hashPassword } from '../auth/password';
import * as schema from './schema';

/** ข้อมูลตั้งต้นสำหรับพัฒนาและทดสอบ รันซ้ำได้ ผลลัพธ์เหมือนเดิมทุกครั้ง */
const client = createScriptClient();
const db = drizzle(client, { schema });

/** แปลงชื่อที่อ่านออกเป็น uuid ตัวเดิมทุกครั้ง (UUID v5, namespace ของ Wingdai เอง) */
function id(key: string): string {
  const h = createHash('sha1').update(`wingdai:seed:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50; // version 5
  h[8] = (h[8]! & 0x3f) | 0x80; // variant RFC 4122
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** รหัสผ่านของทุกบัญชีทดสอบ ยาว 8 ตัวขึ้นไปตามเกณฑ์จริงของระบบ */
const SEED_PASSWORD = 'wingdai1234';

/** PostGIS เรียงพิกัดเป็น (x, y) = (ลองจิจูด, ละติจูด) ซึ่งสลับกับที่คนไทยพูดกันว่า "lat, lng" */
const at = (lng: number, lat: number) => ({ x: lng, y: lat });

/** โซนที่ 1 อารีย์ กรุงเทพฯ ระยะจากขอบถึงขอบราว 1.5 กม. ตรงกับสมมติฐานความหนาแน่นใน product-spec §1 */
const ARI = at(100.5418, 13.7797);
const ARI_BOUNDARY = {
  type: 'Polygon',
  coordinates: [
    [
      [100.5300, 13.7700],
      [100.5520, 13.7700],
      [100.5520, 13.7890],
      [100.5300, 13.7890],
      [100.5300, 13.7700],
    ],
  ],
};

/** ── ร้านชุดสาธิต ──────────────────────────────────────────────────────────── */
const HOME = { lat: 13.7815, lng: 100.545 }; // ที่อยู่ตั้งต้นของ somchai
const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = 108.12; // ที่ละติจูด ~13.8° องศาลองจิจูดสั้นลงตาม cos(lat)

function coordAt(km: number, bearingDeg: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    lat: Number((HOME.lat + (km * Math.cos(rad)) / KM_PER_DEG_LAT).toFixed(5)),
    lng: Number((HOME.lng + (km * Math.sin(rad)) / KM_PER_DEG_LNG).toFixed(5)),
  };
}

type Cuisine = 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert';

/** สามร้านท้ายสุดอยู่นอกรัศมี 5 กม. โดยตั้งใจ พิสูจน์ว่าด่านระยะทำงานจริง (§7) */
const DEMO: {
  key: string; name: string; cuisine: Cuisine; km: number; bearing: number;
  prep: number; area: string; closed?: boolean;
}[] = [
  { key: 'khaomunkai', name: 'ข้าวมันไก่ประตูน้ำ', cuisine: 'rice', km: 0.4, bearing: 20, prep: 10, area: 'ซอยอารีย์ 2' },
  { key: 'boatnoodle', name: 'ก๋วยเตี๋ยวเนื้อตุ๋นอารีย์', cuisine: 'noodle', km: 0.7, bearing: 75, prep: 9, area: 'ซอยอารีย์ 4' },
  { key: 'tammua', name: 'ตำมั่วสาขาอารีย์', cuisine: 'somtam', km: 0.8, bearing: 140, prep: 11, area: 'พหลโยธิน ซอย 7' },
  { key: 'boba', name: 'ชานมไข่มุกอารีย์', cuisine: 'drink', km: 0.5, bearing: 210, prep: 6, area: 'ตลาดอารีย์' },
  { key: 'bingsu', name: 'บิงซูหวานเย็น', cuisine: 'dessert', km: 1.0, bearing: 265, prep: 8, area: 'ซอยอารีย์สัมพันธ์ 3' },
  { key: 'moodaeng', name: 'ข้าวหมูแดงเจ๊หมวย', cuisine: 'rice', km: 1.2, bearing: 310, prep: 12, area: 'ซอยราชครู' },
  { key: 'bamee', name: 'บะหมี่เกี๊ยวกุ้งสะพานควาย', cuisine: 'noodle', km: 1.5, bearing: 45, prep: 10, area: 'สะพานควาย' },
  { key: 'somtamnua', name: 'ส้มตำนัวนัว', cuisine: 'somtam', km: 1.8, bearing: 120, prep: 13, area: 'ซอยพหลโยธิน 9' },
  { key: 'coffee', name: 'กาแฟสดอารีย์โรสต์', cuisine: 'drink', km: 0.9, bearing: 340, prep: 5, area: 'ซอยอารีย์ 5' },
  { key: 'roti', name: 'โรตีชาชักพหลโยธิน', cuisine: 'dessert', km: 1.6, bearing: 190, prep: 7, area: 'พหลโยธิน ซอย 3' },
  { key: 'khamoo', name: 'ข้าวขาหมูตรอกซุง', cuisine: 'rice', km: 2.1, bearing: 95, prep: 11, area: 'ตรอกซุง' },
  { key: 'tomyum', name: 'ก๋วยเตี๋ยวต้มยำเจ๊นิด', cuisine: 'noodle', km: 2.4, bearing: 240, prep: 12, area: 'ซอยเสนานิคม' },
  { key: 'kaengpa', name: 'ข้าวแกงป้าอ้วน', cuisine: 'rice', km: 2.8, bearing: 15, prep: 9, area: 'ซอยวิภาวดี 5', closed: true },
  { key: 'nampan', name: 'น้ำปั่นเจ๊แดง', cuisine: 'drink', km: 3.2, bearing: 160, prep: 6, area: 'อนุสาวรีย์ชัยฯ' },
  { key: 'kanomkrok', name: 'ขนมครกโบราณ', cuisine: 'dessert', km: 3.6, bearing: 285, prep: 10, area: 'ซอยรางน้ำ' },
  { key: 'pnual', name: 'ส้มตำป้านวล', cuisine: 'somtam', km: 4.2, bearing: 60, prep: 14, area: 'ลาดพร้าว ซอย 1' },
  { key: 'silom', name: 'ข้าวต้มสีลม', cuisine: 'rice', km: 7.5, bearing: 185, prep: 12, area: 'สีลม ซอย 3' },
  { key: 'thonglor', name: 'ราเมนทองหล่อ', cuisine: 'noodle', km: 8.4, bearing: 130, prep: 15, area: 'ทองหล่อ ซอย 10' },
  { key: 'bangna', name: 'ส้มตำบางนา', cuisine: 'somtam', km: 14.2, bearing: 150, prep: 12, area: 'บางนา-ตราด กม.3' },
];

const demoShops = DEMO.map((s) => ({
  key: s.key,
  owner: 'chai',
  name: s.name,
  cuisine: s.cuisine,
  addressText: s.area,
  ...coordAt(s.km, s.bearing),
  isApproved: true,
  isOpen: !s.closed,
  prepTimeMinutes: s.prep,
}));

/** แม่แบบเมนูต่อหมวด ตรงกับฝั่งแอป ร้านที่กดเข้าไปแล้วเมนูว่างคือจอที่พังในสายตาคนดู */
const MENU_TEMPLATE: Record<Cuisine, { name: string; priceSatang: number }[]> = {
  rice: [
    { name: 'ข้าวกะเพราหมู', priceSatang: 5000 },
    { name: 'ข้าวผัดหมู', priceSatang: 5500 },
    { name: 'ข้าวไข่เจียว', priceSatang: 4000 },
  ],
  noodle: [
    { name: 'ก๋วยเตี๋ยวหมูน้ำใส', priceSatang: 5000 },
    { name: 'บะหมี่แห้ง', priceSatang: 5500 },
    { name: 'เกาเหลารวมมิตร', priceSatang: 6500 },
  ],
  somtam: [
    { name: 'ส้มตำไทย', priceSatang: 4000 },
    { name: 'ไก่ย่าง', priceSatang: 6500 },
    { name: 'ข้าวเหนียว', priceSatang: 1000 },
  ],
  drink: [
    { name: 'ชาไทยเย็น', priceSatang: 2500 },
    { name: 'อเมริกาโน่เย็น', priceSatang: 5500 },
    { name: 'น้ำส้มคั้นสด', priceSatang: 4500 },
  ],
  dessert: [
    { name: 'บัวลอยไข่หวาน', priceSatang: 4000 },
    { name: 'ไอศกรีมกะทิ', priceSatang: 3500 },
    { name: 'ขนมครก', priceSatang: 3000 },
  ],
};

// ตัวเลือกต่อหมวด กลุ่มแรกบังคับเลือกหนึ่งอย่าง กลุ่มที่สองเลือกได้หลายอย่างและบวกราคา
const OPTIONS_TEMPLATE: Record<Cuisine, { id: string; name: string; minSelect: number; maxSelect: number; choices: { id: string; name: string; priceDelta: number }[] }[]> = {
  rice: [
    { id: 'spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1, choices: [
      { id: 'spicy-none', name: 'ไม่เผ็ด', priceDelta: 0 },
      { id: 'spicy-mild', name: 'เผ็ดน้อย', priceDelta: 0 },
      { id: 'spicy-hot', name: 'เผ็ดมาก', priceDelta: 0 },
    ] },
    { id: 'extra', name: 'เพิ่มพิเศษ', minSelect: 0, maxSelect: 2, choices: [
      { id: 'extra-egg', name: 'ไข่ดาว', priceDelta: 1000 },
      { id: 'extra-rice', name: 'ข้าวเพิ่ม', priceDelta: 500 },
    ] },
  ],
  noodle: [
    { id: 'noodle-type', name: 'เส้น', minSelect: 1, maxSelect: 1, choices: [
      { id: 'noodle-sen-lek', name: 'เส้นเล็ก', priceDelta: 0 },
      { id: 'noodle-sen-yai', name: 'เส้นใหญ่', priceDelta: 0 },
      { id: 'noodle-bamee', name: 'บะหมี่', priceDelta: 0 },
    ] },
    { id: 'noodle-extra', name: 'เพิ่มพิเศษ', minSelect: 0, maxSelect: 2, choices: [
      { id: 'noodle-extra-meat', name: 'เนื้อเพิ่ม', priceDelta: 2000 },
      { id: 'noodle-extra-ball', name: 'ลูกชิ้นเพิ่ม', priceDelta: 1500 },
    ] },
  ],
  somtam: [
    { id: 'tam-spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1, choices: [
      { id: 'tam-1', name: '1 เม็ด', priceDelta: 0 },
      { id: 'tam-3', name: '3 เม็ด', priceDelta: 0 },
      { id: 'tam-5', name: '5 เม็ด', priceDelta: 0 },
    ] },
    { id: 'tam-extra', name: 'เพิ่มพิเศษ', minSelect: 0, maxSelect: 2, choices: [
      { id: 'tam-pu', name: 'ปูดอง', priceDelta: 2000 },
      { id: 'tam-khai-kem', name: 'ไข่เค็ม', priceDelta: 1500 },
    ] },
  ],
  drink: [
    { id: 'sweet', name: 'ความหวาน', minSelect: 1, maxSelect: 1, choices: [
      { id: 'sweet-0', name: 'ไม่หวาน', priceDelta: 0 },
      { id: 'sweet-50', name: 'หวานน้อย', priceDelta: 0 },
      { id: 'sweet-100', name: 'หวานปกติ', priceDelta: 0 },
    ] },
    { id: 'drink-extra', name: 'เพิ่มพิเศษ', minSelect: 0, maxSelect: 2, choices: [
      { id: 'drink-shot', name: 'ช็อตเพิ่ม', priceDelta: 1500 },
      { id: 'drink-pearl', name: 'ไข่มุก', priceDelta: 1000 },
    ] },
  ],
  dessert: [
    { id: 'dessert-serve', name: 'เสิร์ฟแบบ', minSelect: 1, maxSelect: 1, choices: [
      { id: 'dessert-cold', name: 'เย็น', priceDelta: 0 },
      { id: 'dessert-warm', name: 'อุ่น', priceDelta: 0 },
    ] },
    { id: 'dessert-extra', name: 'เพิ่มพิเศษ', minSelect: 0, maxSelect: 1, choices: [
      { id: 'dessert-topping', name: 'ท็อปปิ้งเพิ่ม', priceDelta: 1000 },
    ] },
  ],
};

const demoMenu = DEMO.flatMap((s) =>
  MENU_TEMPLATE[s.cuisine].map((item, i) => ({
    key: `${s.key}-${i + 1}`,
    restaurant: s.key,
    name: item.name,
    priceSatang: item.priceSatang,
    category: s.cuisine,
    // จานสุดท้ายของทุกร้านหมด เพื่อให้ป้าย "วันนี้หมดแล้ว" มีของให้เห็นทุกร้าน
    isAvailable: i < MENU_TEMPLATE[s.cuisine].length - 1,
    // id ของตัวเลือกต้องไม่ชนกันข้ามจาน เพราะตะกร้าอ้างถึงมันตรง ๆ ตอนสั่งซ้ำ
    optionGroups: OPTIONS_TEMPLATE[s.cuisine].map((g) => ({
      ...g,
      id: `${s.key}-${i + 1}-${g.id}`,
      choices: g.choices.map((c) => ({ ...c, id: `${s.key}-${i + 1}-${c.id}` })),
    })),
  })),
);

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const now = new Date();

  await db.transaction(async (tx) => {
    /** ราคาตั้งต้น (design SA6) ค่าเดียวกับค่าคงที่ในโค้ด (`DEFAULT_PRICING`) */
    await tx.insert(schema.platformPricing).values({ singleton: true }).onConflictDoNothing();

    await tx
      .insert(schema.zones)
      .values({
        id: id('zone:ari'),
        name: 'อารีย์',
        type: 'mixed',
        boundaryGeojson: ARI_BOUNDARY,
        center: ARI,
        isActive: true,
        // ช่วงพีคเป็น "ข้อมูลของโซนนี้" ไม่ใช่ตรรกะที่แตกตามชนิดโซน (product-spec §7)
        demandConfig: { peakHours: [[11, 13], [17, 20]] },
      })
      .onConflictDoUpdate({
        target: schema.zones.id,
        set: { name: 'อารีย์', isActive: true, center: ARI, boundaryGeojson: ARI_BOUNDARY },
      });

    const people = [
      { key: 'somchai', accountType: 'user', fullName: 'สมชาย ใจดี', phone: '0812345678' },
      { key: 'malee', accountType: 'user', fullName: 'มาลี ศรีสุข', phone: '0823456789' },
      { key: 'chai', accountType: 'user', fullName: 'ชัย รุ่งเรือง', phone: '0867890123' },
      { key: 'rider_ann', accountType: 'rider', fullName: 'อรอนงค์ ว่องไว', phone: '0834567890' },
      { key: 'rider_new', accountType: 'rider', fullName: 'ณัฐพล เพิ่งสมัคร', phone: '0845678901' },
      { key: 'admin_root', accountType: 'admin', fullName: 'ผู้ดูแลระบบ', phone: '0856789012' },
      /** ซูเปอร์แอดมิน (product-spec §7 คลื่น 2) */
      { key: 'super_root', accountType: 'super_admin', fullName: 'ผู้ดูแลระบบระดับสูง', phone: '0867890124' },
    ] as const;

    for (const p of people) {
      await tx
        .insert(schema.accounts)
        .values({
          id: id(`account:${p.key}`),
          accountType: p.accountType,
          username: p.key,
          passwordHash,
          fullName: p.fullName,
          phone: p.phone,
          // บัญชีทดสอบข้ามขั้นยืนยันเบอร์ ไม่มีผู้ให้บริการ SMS ให้ส่งจริงอยู่แล้ว (product-spec §11 ข้อ 3)
          phoneVerifiedAt: now,
          email: `${p.key}@wingdai.test`,
        })
        .onConflictDoUpdate({
          target: schema.accounts.id,
          set: { passwordHash, fullName: p.fullName, phone: p.phone, phoneVerifiedAt: now },
        });
    }

    // ไรเดอร์อนุมัติแล้วหนึ่งคน รออนุมัติหนึ่งคน ต้องมีทั้งสองสถานะไว้ทดสอบจอ "รอการอนุมัติ"
    const riders = [
      { key: 'rider_ann', approval: 'approved' as const, nationalId: '1103700000011', plate: 'กข 1234 กทม' },
      { key: 'rider_new', approval: 'pending' as const, nationalId: '1103700000029', plate: 'งจ 5678 กทม' },
    ];
    for (const r of riders) {
      const profile = {
        accountId: id(`account:${r.key}`),
        approval: r.approval,
        approvedAt: r.approval === 'approved' ? now : null,
        nationalId: r.nationalId,
        dateOfBirth: '1998-05-12',
        vehicleRegistration: r.plate,
        licenceExpiry: '2029-12-31',
        compulsoryInsuranceExpiry: '2027-06-30',
        bankName: 'กสิกรไทย',
        bankAccountNumber: '1234567890',
        // ต้องตรงกับชื่อตามกฎหมาย เป็นด่านกันบัญชีม้า (product-spec §7)
        bankAccountName: r.key === 'rider_ann' ? 'อรอนงค์ ว่องไว' : 'ณัฐพล เพิ่งสมัคร',
        emergencyContactName: 'ญาติใกล้ชิด',
        emergencyContactPhone: '0899999999',
        preferredZoneId: id('zone:ari'),
        contractSignedAt: now,
        pdpaConsentAt: now,
      };
      await tx
        .insert(schema.riderProfiles)
        .values(profile)
        .onConflictDoUpdate({ target: schema.riderProfiles.accountId, set: profile });
    }

    const restaurants = [
      {
        key: 'malee', owner: 'malee', name: 'ครัวมาลี', cuisine: 'rice' as const,
        addressText: 'ซอยอารีย์ 1 พหลโยธิน', lng: 100.5432, lat: 13.7802,
        isApproved: true, isOpen: true, prepTimeMinutes: 12,
      },
      {
        key: 'somtam', owner: 'chai', name: 'ส้มตำแซ่บนัว', cuisine: 'somtam' as const,
        addressText: 'ซอยอารีย์สัมพันธ์ 7', lng: 100.5388, lat: 13.7821,
        isApproved: true, isOpen: true, prepTimeMinutes: 10,
      },
      {
        key: 'closed', owner: 'chai', name: 'ก๋วยเตี๋ยวเรือ', cuisine: 'noodle' as const,
        addressText: 'ตลาดอารีย์', lng: 100.5405, lat: 13.7776,
        isApproved: true, isOpen: false, prepTimeMinutes: 8,
      },
      {
        key: 'pending', owner: 'somchai', name: 'ร้านรออนุมัติ', cuisine: 'rice' as const,
        addressText: 'ซอยพหลโยธิน 7', lng: 100.5441, lat: 13.7768,
        isApproved: false, isOpen: false, prepTimeMinutes: 15,
      },
      ...demoShops,
    ];

    for (const r of restaurants) {
      const row = {
        id: id(`restaurant:${r.key}`),
        ownerUserId: id(`account:${r.owner}`),
        zoneId: id('zone:ari'),
        name: r.name,
        cuisine: r.cuisine,
        addressText: r.addressText,
        location: at(r.lng, r.lat),
        isApproved: r.isApproved,
        approvedAt: r.isApproved ? now : null,
        isOpen: r.isOpen,
        prepTimeMinutes: r.prepTimeMinutes,
        openingHours: { mon_sun: ['09:00', '21:00'] },
      };
      await tx
        .insert(schema.restaurants)
        .values(row)
        .onConflictDoUpdate({ target: schema.restaurants.id, set: row });
    }

    /** ราคาเป็นสตางค์และต้องเท่าราคาหน้าร้านเป๊ะ ห้ามบวกค่าธรรมเนียมลงไป (product-spec §3 ข้อ 2) */
    const menu = [
      {
        key: 'malee-1', restaurant: 'malee', name: 'ข้าวกะเพราหมูสับ', description: 'ไข่ดาวกรอบ',
        priceSatang: 5000, category: 'rice' as const, isAvailable: true,
        optionGroups: [
          { id: 'g-spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1, choices: [
            { id: 'c-spicy-low', name: 'เผ็ดน้อย', priceDelta: 0 },
            { id: 'c-spicy-mid', name: 'เผ็ดกลาง', priceDelta: 0 },
            { id: 'c-spicy-high', name: 'เผ็ดมาก', priceDelta: 0 },
          ] },
          { id: 'g-topping', name: 'ท็อปปิ้ง', minSelect: 0, maxSelect: 2, choices: [
            { id: 'c-egg', name: 'ไข่ดาว', priceDelta: 1500 },
            { id: 'c-sausage', name: 'กุนเชียง', priceDelta: 1500 },
          ] },
        ],
      },
      {
        key: 'malee-2', restaurant: 'malee', name: 'ข้าวผัดกุ้ง',
        priceSatang: 6000, category: 'rice' as const, isAvailable: true,
        optionGroups: [
          { id: 'g-m2-spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1, choices: [
            { id: 'c-m2-mild', name: 'ไม่เผ็ด', priceDelta: 0 },
            { id: 'c-m2-hot', name: 'เผ็ด', priceDelta: 0 },
          ] },
          { id: 'g-m2-extra', name: 'เพิ่มพิเศษ', minSelect: 0, maxSelect: 2, choices: [
            { id: 'c-m2-shrimp', name: 'เพิ่มกุ้ง', priceDelta: 3000 },
            { id: 'c-m2-egg', name: 'ไข่ดาว', priceDelta: 1500 },
          ] },
        ],
      },
      {
        key: 'malee-3', restaurant: 'malee', name: 'ข้าวมันไก่',
        priceSatang: 4500, category: 'rice' as const, isAvailable: true,
        optionGroups: [
          { id: 'g-m3-part', name: 'ส่วนของไก่', minSelect: 1, maxSelect: 1, choices: [
            { id: 'c-m3-thigh', name: 'สะโพก', priceDelta: 0 },
            { id: 'c-m3-breast', name: 'อก', priceDelta: 0 },
          ] },
        ],
      },
      { key: 'malee-4', restaurant: 'malee', name: 'ชาไทยเย็น', priceSatang: 2500, category: 'drink' as const, isAvailable: true, optionGroups: [] },
      { key: 'malee-5', restaurant: 'malee', name: 'ข้าวหมูทอด', priceSatang: 5000, category: 'rice' as const, isAvailable: false, optionGroups: [] },
      {
        key: 'somtam-1', restaurant: 'somtam', name: 'ส้มตำไทย',
        priceSatang: 4000, category: 'somtam' as const, isAvailable: true,
        optionGroups: [
          { id: 'g-st1-spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1, choices: [
            { id: 'c-st1-1', name: 'เผ็ดน้อย', priceDelta: 0 },
            { id: 'c-st1-2', name: 'เผ็ดกลาง', priceDelta: 0 },
            { id: 'c-st1-3', name: 'เผ็ดมาก', priceDelta: 0 },
          ] },
          { id: 'g-st1-add', name: 'เพิ่มเติม', minSelect: 0, maxSelect: 2, choices: [
            { id: 'c-st1-shrimp', name: 'กุ้งสด', priceDelta: 2000 },
            { id: 'c-st1-crab', name: 'ปูเค็ม', priceDelta: 1500 },
          ] },
        ],
      },
      {
        key: 'somtam-2', restaurant: 'somtam', name: 'ไก่ย่าง',
        priceSatang: 6500, category: 'somtam' as const, isAvailable: true,
        optionGroups: [
          { id: 'g-st2-part', name: 'ส่วน', minSelect: 1, maxSelect: 1, choices: [
            { id: 'c-st2-leg', name: 'น่อง', priceDelta: 0 },
            { id: 'c-st2-breast', name: 'อก', priceDelta: 0 },
            { id: 'c-st2-thigh', name: 'สะโพก', priceDelta: 0 },
          ] },
        ],
      },
      { key: 'somtam-3', restaurant: 'somtam', name: 'ข้าวเหนียว', priceSatang: 1000, category: 'rice' as const, isAvailable: true, optionGroups: [] },
      { key: 'somtam-4', restaurant: 'somtam', name: 'น้ำมะพร้าว', priceSatang: 3000, category: 'drink' as const, isAvailable: true, optionGroups: [] },
      {
        key: 'closed-1', restaurant: 'closed', name: 'ก๋วยเตี๋ยวเรือหมู',
        priceSatang: 5000, category: 'noodle' as const, isAvailable: true,
        optionGroups: [
          { id: 'g-cl1-noodle', name: 'เส้น', minSelect: 1, maxSelect: 1, choices: [
            { id: 'c-cl1-small', name: 'เส้นเล็ก', priceDelta: 0 },
            { id: 'c-cl1-big', name: 'เส้นใหญ่', priceDelta: 0 },
            { id: 'c-cl1-mama', name: 'บะหมี่', priceDelta: 0 },
          ] },
          { id: 'g-cl1-extra', name: 'พิเศษ', minSelect: 0, maxSelect: 1, choices: [
            { id: 'c-cl1-meat', name: 'เพิ่มเนื้อ', priceDelta: 1500 },
          ] },
        ],
      },
      { key: 'closed-2', restaurant: 'closed', name: 'เกาเหลา', priceSatang: 5500, category: 'noodle' as const, isAvailable: true, optionGroups: [] },
      ...demoMenu,
    ];

    for (const m of menu) {
      const row = {
        id: id(`menu:${m.key}`),
        restaurantId: id(`restaurant:${m.restaurant}`),
        name: m.name,
        description: 'description' in m ? m.description : null,
        priceSatang: m.priceSatang,
        category: m.category,
        isAvailable: m.isAvailable,
        optionGroups: m.optionGroups,
      };
      await tx
        .insert(schema.menuItems)
        .values(row)
        .onConflictDoUpdate({ target: schema.menuItems.id, set: row });
    }

    const addresses = [
      { key: 'somchai-home', account: 'somchai', label: 'บ้าน', addressText: 'ซอยอารีย์ 3 คอนโดอารีย์เพลส ห้อง 502', note: 'ฝากไว้ที่นิติได้', lng: 100.5450, lat: 13.7815 },
      { key: 'somchai-work', account: 'somchai', label: 'ที่ทำงาน', addressText: 'อาคารพหลโยธินเพลส ชั้น 12', note: null, lng: 100.5395, lat: 13.7789 },
    ];
    for (const a of addresses) {
      const row = {
        id: id(`address:${a.key}`),
        accountId: id(`account:${a.account}`),
        label: a.label,
        addressText: a.addressText,
        note: a.note,
        location: at(a.lng, a.lat),
        zoneId: id('zone:ari'),
      };
      await tx
        .insert(schema.addresses)
        .values(row)
        .onConflictDoUpdate({ target: schema.addresses.id, set: row });
    }

    console.log(
      `โซน 1 · บัญชี ${people.length} · ร้าน ${restaurants.length} · เมนู ${menu.length} · ที่อยู่ ${addresses.length}`,
    );
  });

  console.log(`เสร็จเรียบร้อย — ทุกบัญชีใช้รหัสผ่าน ${SEED_PASSWORD}`);
  await client.end();
}

main().catch(async (error) => {
  console.error('seed ล้มเหลว:', error.message);
  if (error.query) console.error('คำสั่งที่พัง:\n', String(error.query).trim().slice(0, 400));
  await client.end();
  process.exit(1);
});
