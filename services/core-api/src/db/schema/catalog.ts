import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { cuisineCategory } from './enums';
import { satang } from './money';
import { accounts } from './accounts';
import { point, zones } from './zones';

/**
 * claude.md §4.3 · §7
 *
 * ร้านเป็น "ความสามารถ" ที่งอกบนบัญชี type 'user' ไม่ใช่ประเภทบัญชี
 * owner_user_id คือจุดเดียวที่บอกว่าใครเป็นเจ้าของร้าน และเป็นตัวที่ใช้กันไม่ให้สั่งร้านตัวเอง
 */
export const restaurants = pgTable(
  'restaurants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => zones.id),
    name: text('name').notNull(),
    cuisine: cuisineCategory('cuisine').notNull(),
    addressText: text('address_text').notNull(),
    location: point('location').notNull(),

    /** แอดมินอนุมัติแล้วเท่านั้นถึงจะโผล่ให้ลูกค้าเห็น */
    isApproved: boolean('is_approved').notNull().default(false),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    /** ร้านกดเปิด/ปิดเอง ต่างจาก isApproved ที่แอดมินคุม */
    isOpen: boolean('is_open').notNull().default(false),

    /**
     * เวลาทำอาหารที่ร้านตั้งเอง (นาที) — claude.md §6.3 ใช้ค่านี้ seed ตอนยังไม่มีข้อมูลย้อนหลัง
     * พอมีออร์เดอร์จริงแล้วค่อยเปลี่ยนไปใช้ค่าเฉลี่ยเคลื่อนที่ แต่ค่านี้ยังต้องอยู่เป็น fallback
     */
    prepTimeMinutes: integer('prep_time_minutes').notNull(),

    openingHours: jsonb('opening_hours').notNull().default(sql`'{}'::jsonb`),
    storefrontPhotoPath: text('storefront_photo_path'),
    businessDocPath: text('business_doc_path'),

    bankName: text('bank_name'),
    bankAccountNumber: text('bank_account_number'),
    bankAccountName: text('bank_account_name'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('restaurants_owner_idx').on(t.ownerUserId),
    index('restaurants_zone_idx').on(t.zoneId),
    check('restaurants_prep_time_sane', sql`${t.prepTimeMinutes} between 1 and 120`),
  ],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /**
     * ราคาเท่าหน้าร้านเป๊ะ (claude.md §3 ข้อ 2)
     * ห้ามบวกค่าธรรมเนียมอะไรลงในช่องนี้เด็ดขาด ค่าส่ง/ค่าบริการมีบรรทัดของตัวเองในออร์เดอร์
     */
    priceSatang: satang('price_satang').notNull(),
    category: cuisineCategory('category').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    photoPath: text('photo_path'),
    /** กลุ่มตัวเลือก (ระดับเผ็ด ท็อปปิ้ง) — โครงยืดหยุ่นและอ่านทั้งก้อนเสมอ จึงเก็บเป็น jsonb */
    optionGroups: jsonb('option_groups').notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('menu_items_restaurant_idx').on(t.restaurantId),
    check('menu_items_price_positive', sql`${t.priceSatang} > 0`),
  ],
);
