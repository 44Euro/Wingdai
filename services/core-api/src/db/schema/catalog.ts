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

/** product-spec §4.3 §7 */
export const restaurants = pgTable(
  'restaurants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    /** โซนเป็น ข้อมูลประกอบ ไม่ใช่ด่าน ร้านอยู่ที่ไหนในไทยก็เปิดได้ */
    zoneId: uuid('zone_id').references(() => zones.id),
    name: text('name').notNull(),
    cuisine: cuisineCategory('cuisine').notNull(),
    addressText: text('address_text').notNull(),
    location: point('location').notNull(),

    /** แอดมินอนุมัติแล้วเท่านั้นถึงจะโผล่ให้ลูกค้าเห็น */
    isApproved: boolean('is_approved').notNull().default(false),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    /** ร้านกดเปิด/ปิดเอง ต่างจาก isApproved ที่แอดมินคุม */
    isOpen: boolean('is_open').notNull().default(false),

    /** เวลาทำอาหารที่ร้านตั้งเอง (นาที) product-spec §6.3 ใช้ค่านี้ seed ตอนยังไม่มีข้อมูลย้อนหลัง */
    prepTimeMinutes: integer('prep_time_minutes').notNull(),

    openingHours: jsonb('opening_hours').notNull().default(sql`'{}'::jsonb`),
    /** พักรับออเดอร์ชั่วคราว (design M11) `null` = ไม่ได้พัก */
    pausedUntil: timestamp('paused_until', { withTimezone: true }),
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
    /** ราคาเท่าหน้าร้านเป๊ะ (product-spec §3 ข้อ 2) */
    priceSatang: satang('price_satang').notNull(),
    category: cuisineCategory('category').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    photoPath: text('photo_path'),
    /** กลุ่มตัวเลือก (ระดับเผ็ด ท็อปปิ้ง) โครงยืดหยุ่นและอ่านทั้งก้อนเสมอ จึงเก็บเป็น jsonb */
    optionGroups: jsonb('option_groups').notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('menu_items_restaurant_idx').on(t.restaurantId),
    check('menu_items_price_positive', sql`${t.priceSatang} > 0`),
  ],
);
