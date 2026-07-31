import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createScriptClient } from './client';
import { drizzle } from 'drizzle-orm/postgres-js';
import { hashPassword } from '../auth/password';
import * as schema from './schema';

/**
 * ข้อมูลตั้งต้นสำหรับพัฒนาและทดสอบ — รันซ้ำได้ ผลลัพธ์เหมือนเดิมทุกครั้ง
 *
 * ตั้งใจให้ตรงกับ apps/mobile/src/data/mock/seed.ts เพื่อที่ตอนสลับแอปจากรีโปจำลอง
 * ไปใช้ของจริง หน้าจอจะแสดงเหมือนเดิมเป๊ะ — ถ้ามีอะไรเพี้ยนจะได้รู้ทันทีว่าเป็นบั๊กของ backend
 * ไม่ใช่เพราะข้อมูลคนละชุด
 *
 * ห้ามรันกับฐาน production — สคริปต์นี้ทับข้อมูลของแถวที่ id ตรงกัน
 */
const client = createScriptClient();
const db = drizzle(client, { schema });

/**
 * แปลงชื่อที่อ่านออกเป็น uuid ตัวเดิมทุกครั้ง (UUID v5, namespace ของ Wingdai เอง)
 *
 * ทำแบบนี้เพื่อให้ seed รันซ้ำได้ด้วย ON CONFLICT (id) ตรง ๆ โดยไม่ต้องไล่ลบของเก่าก่อน
 * และเวลาส่อง ledger หรือ log ก็ยังเทียบกลับมาที่ชื่อในไฟล์นี้ได้
 */
function id(key: string): string {
  const h = createHash('sha1').update(`wingdai:seed:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50; // version 5
  h[8] = (h[8]! & 0x3f) | 0x80; // variant RFC 4122
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** รหัสผ่านของทุกบัญชีทดสอบ — ยาว 8 ตัวขึ้นไปตามเกณฑ์จริงของระบบ */
const SEED_PASSWORD = 'wingdai1234';

/**
 * PostGIS เรียงพิกัดเป็น (x, y) = (ลองจิจูด, ละติจูด) ซึ่งสลับกับที่คนไทยพูดกันว่า "lat, lng"
 * ห่อไว้ด้วยฟังก์ชันที่ตั้งชื่อชัดเจน จะได้ไม่มีใครสลับสองค่านี้แล้วได้ร้านไปโผล่กลางทะเลโซมาเลีย
 */
const at = (lng: number, lat: number) => ({ x: lng, y: lat });

/** โซนที่ 1 — อารีย์ กรุงเทพฯ ระยะจากขอบถึงขอบราว 1.5 กม. ตรงกับสมมติฐานความหนาแน่นใน claude.md §1 */
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

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.zones)
      .values({
        id: id('zone:ari'),
        name: 'อารีย์',
        type: 'mixed',
        boundaryGeojson: ARI_BOUNDARY,
        center: ARI,
        isActive: true,
        // ช่วงพีคเป็น "ข้อมูลของโซนนี้" ไม่ใช่ตรรกะที่แตกตามชนิดโซน (claude.md §7)
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
          // บัญชีทดสอบข้ามขั้นยืนยันเบอร์ — ไม่มีผู้ให้บริการ SMS ให้ส่งจริงอยู่แล้ว (claude.md §11 ข้อ 3)
          phoneVerifiedAt: now,
          email: `${p.key}@wingdai.test`,
        })
        .onConflictDoUpdate({
          target: schema.accounts.id,
          set: { passwordHash, fullName: p.fullName, phone: p.phone, phoneVerifiedAt: now },
        });
    }

    // ไรเดอร์อนุมัติแล้วหนึ่งคน รออนุมัติหนึ่งคน — ต้องมีทั้งสองสถานะไว้ทดสอบจอ "รอการอนุมัติ"
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
        // ต้องตรงกับชื่อตามกฎหมาย เป็นด่านกันบัญชีม้า (claude.md §7)
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

    /** ราคาเป็นสตางค์และต้องเท่าราคาหน้าร้านเป๊ะ ห้ามบวกค่าธรรมเนียมลงไป (claude.md §3 ข้อ 2) */
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
