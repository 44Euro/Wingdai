import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { orderStatus, paymentMethod, paymentStatus } from './enums';
import { satang } from './money';
import { accounts } from './accounts';
import { restaurants, menuItems } from './catalog';
import { point, zones } from './zones';

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    addressText: text('address_text').notNull(),
    note: text('note'),
    location: point('location').notNull(),
    zoneId: uuid('zone_id').references(() => zones.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('addresses_account_idx').on(t.accountId)],
);

/**
 * claude.md §6.1 · §6.2 · §6.5
 *
 * ยอดทุกช่องเป็นสตางค์ และ **แยกบรรทัดเสมอ** — ห้ามยุบค่าส่ง/ค่าบริการเข้าไปในค่าอาหาร
 * เพราะราคาอาหารต้องเท่าหน้าร้านเป๊ะ (§3 ข้อ 2) ซึ่งเป็นทั้งจุดขายและข้อสัญญากับร้าน
 *
 * commission_satang เก็บค่าที่คิดจริง ณ ตอนสั่ง ไม่ได้คำนวณสดตอนอ่าน
 * เพราะถ้าอัตรา GP เปลี่ยนวันหลัง ออร์เดอร์เก่าต้องยังบอกได้ว่าตอนนั้นคิดเท่าไหร่
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** เลขที่ออร์เดอร์ที่ลูกค้าเห็น — สั้น อ่านออก ไม่ใช่ uuid */
    reference: text('reference').notNull(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'restrict' }),
    riderId: uuid('rider_id').references(() => accounts.id, { onDelete: 'restrict' }),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => zones.id),
    deliveryAddressId: uuid('delivery_address_id')
      .notNull()
      .references(() => addresses.id, { onDelete: 'restrict' }),

    status: orderStatus('status').notNull().default('created'),

    foodTotalSatang: satang('food_total_satang').notNull(),
    deliveryFeeSatang: satang('delivery_fee_satang').notNull(),
    serviceFeeSatang: satang('service_fee_satang').notNull(),
    /** = 15% ของค่าอาหาร ณ เวลาที่สั่ง (§6.1) ไม่คิดจากค่าส่ง/ค่าบริการ */
    commissionSatang: satang('commission_satang').notNull(),

    paymentMethod: paymentMethod('payment_method').notNull(),
    paymentStatus: paymentStatus('payment_status').notNull().default('pending'),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    /** §6.3 เวลาที่คาดว่าอาหารจะเสร็จ ใช้ตัดสินว่าจะจ่ายงานให้ไรเดอร์ตอนไหน */
    predictedReadyAt: timestamp('predicted_ready_at', { withTimezone: true }),

    /** §8 ต้องเก็บตั้งแต่วันแรก ไม่งั้นคำนวณ Orders per Rider Hour ย้อนหลังไม่ได้ */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    deliveryPhotoPath: text('delivery_photo_path'),
  },
  (t) => [
    index('orders_customer_idx').on(t.customerId),
    index('orders_restaurant_status_idx').on(t.restaurantId, t.status),
    index('orders_rider_idx').on(t.riderId),
    index('orders_zone_created_idx').on(t.zoneId, t.createdAt),
    uniqueIndex('orders_reference_key').on(t.reference),

    // §4.3 กันสั่งร้านตัวเอง — ตรวจที่ชั้นแอปด้วย แต่บังคับที่ฐานเป็นด่านสุดท้าย
    // (เทียบกับ restaurants.owner_user_id ต้องใช้ trigger เพราะ CHECK อ้างข้ามตารางไม่ได้
    //  ดู migration ไฟล์แรก)
    check('orders_amounts_non_negative', sql`
      ${t.foodTotalSatang} > 0
      and ${t.deliveryFeeSatang} >= 0
      and ${t.serviceFeeSatang} >= 0
      and ${t.commissionSatang} >= 0
    `),
    // ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้ (§4.3)
    check('orders_rider_is_not_customer', sql`${t.riderId} is null or ${t.riderId} <> ${t.customerId}`),
  ],
);

/**
 * แช่แข็งชื่อและราคาไว้ตอนสั่ง — ห้าม join ไปอ่านราคาปัจจุบันของเมนู
 * เพราะร้านแก้ราคาเมื่อไหร่ ใบเสร็จเก่าจะเปลี่ยนตาม ซึ่งผิดทั้งทางบัญชีและทางกฎหมาย
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** อ้างถึงเมนูไว้ทำรายงาน แต่ราคา/ชื่อที่ใช้จริงคือช่องด้านล่าง */
    menuItemId: uuid('menu_item_id').references(() => menuItems.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    unitPriceSatang: satang('unit_price_satang').notNull(),
    quantity: integer('quantity').notNull(),
    selectedChoices: jsonb('selected_choices').notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
    check('order_items_price_positive', sql`${t.unitPriceSatang} > 0`),
  ],
);
