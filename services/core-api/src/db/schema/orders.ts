import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  char,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { orderStatus, paymentMethod, paymentStatus, cancelReason, cancelledBy } from './enums';
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

/** product-spec §6.1 §6.2 §6.5 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** เลขที่ออเดอร์ที่ลูกค้าเห็น สั้น อ่านออก ไม่ใช่ uuid */
    reference: text('reference').notNull(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'restrict' }),
    riderId: uuid('rider_id').references(() => accounts.id, { onDelete: 'restrict' }),
    /** โซนของร้าน ณ ตอนสั่ง ไว้ทำรายงาน ไม่ใช่ด่าน (ดูหมายเหตุที่ restaurants.zone_id) */
    zoneId: uuid('zone_id').references(() => zones.id),
    deliveryAddressId: uuid('delivery_address_id')
      .notNull()
      .references(() => addresses.id, { onDelete: 'restrict' }),

    status: orderStatus('status').notNull().default('created'),

    foodTotalSatang: satang('food_total_satang').notNull(),
    deliveryFeeSatang: satang('delivery_fee_satang').notNull(),
    serviceFeeSatang: satang('service_fee_satang').notNull(),
    /** ยอดคอม ณ เวลาที่สั่ง (§6.1) คิดจากค่าอาหารเท่านั้น ไม่รวมค่าส่ง/ค่าบริการ */
    commissionSatang: satang('commission_satang').notNull(),
    /** อัตราที่ใช้กับใบนี้ (basis point) แช่แข็งไว้ตอนสั่ง */
    commissionRateBp: satang('commission_rate_bp').notNull().default(1500),

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
    /** ทำไมถึงถูกยกเลิก (design M12) `null` เมื่อไม่ใช่ร้านเป็นคนปฏิเสธ */
    cancelReason: cancelReason('cancel_reason'),
    cancelledBy: cancelledBy('cancelled_by'),

    deliveryPhotoPath: text('delivery_photo_path'),

    /** ลูกค้าขอให้วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
    leaveAtDoor: boolean('leave_at_door').notNull().default(false),
    /** ทิปที่ลูกค้าให้ไรเดอร์หลังส่งถึงแล้ว (design C11) 0 = ไม่ให้ ซึ่งเป็นค่าปกติ */
    tipSatang: integer('tip_satang').notNull().default(0),

    /** รหัสยืนยันส่งสี่หลัก (design R11) ลูกค้าเห็น ไรเดอร์ต้องกรอกให้ตรงตอนปิดงาน */
    deliveryPin: char('delivery_pin', { length: 4 }).notNull(),
  },
  (t) => [
    check('orders_delivery_pin_format', sql`${t.deliveryPin} ~ '^[0-9]{4}$'`),
    index('orders_customer_idx').on(t.customerId),
    index('orders_restaurant_status_idx').on(t.restaurantId, t.status),
    index('orders_rider_idx').on(t.riderId),
    index('orders_zone_created_idx').on(t.zoneId, t.createdAt),
    uniqueIndex('orders_reference_key').on(t.reference),

    // §4.3 กันสั่งร้านตัวเอง ตรวจที่ชั้นแอปด้วย แต่บังคับที่ฐานเป็นด่านสุดท้าย
    check('orders_amounts_non_negative', sql`
      ${t.foodTotalSatang} > 0
      and ${t.deliveryFeeSatang} >= 0
      and ${t.serviceFeeSatang} >= 0
      and ${t.commissionSatang} >= 0
      and ${t.tipSatang} >= 0
    `),
    // ไรเดอร์รับงานออเดอร์ที่ตัวเองสั่งไม่ได้ (§4.3)
    check('orders_rider_is_not_customer', sql`${t.riderId} is null or ${t.riderId} <> ${t.customerId}`),
  ],
);

/** แช่แข็งชื่อและราคาไว้ตอนสั่ง ห้าม join ไปอ่านราคาปัจจุบันของเมนู */
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
    /** ข้อความที่ลูกค้าฝากถึงร้านสำหรับจานนี้ เช่น "ไม่ใส่ผักชี" "เผ็ดน้อย" */
    note: text('note'),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
    check('order_items_price_positive', sql`${t.unitPriceSatang} > 0`),
  ],
);
