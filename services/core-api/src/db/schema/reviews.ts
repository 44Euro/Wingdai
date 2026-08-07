import { pgTable, uuid, text, integer, timestamp, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { orders } from './orders';
import { restaurants } from './catalog';

/** รีวิวหนึ่งใบ ผูกกับออร์เดอร์หนึ่งใบ (design C11 C36 M9) */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** คนเขียน = ลูกค้าเจ้าของออร์เดอร์ เก็บไว้เพื่อไม่ต้อง join orders ทุกครั้งที่อ่าน */
    authorAccountId: uuid('author_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    /** null = ออร์เดอร์นั้นไม่มีไรเดอร์ หรือลูกค้าเลือกไม่ให้คะแนนไรเดอร์ */
    riderAccountId: uuid('rider_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    restaurantRating: integer('restaurant_rating').notNull(),
    riderRating: integer('rider_rating'),
    comment: text('comment'),
    /** เส้นทางรูปในบักเก็ต `public-media` รูปอาหารในรีวิวตั้งใจให้คนอื่นเห็น */
    photoPaths: text('photo_paths').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('reviews_one_per_order').on(t.orderId),
    check('reviews_restaurant_rating_range', sql`${t.restaurantRating} between 1 and 5`),
    check('reviews_rider_rating_range', sql`${t.riderRating} is null or ${t.riderRating} between 1 and 5`),
    /** จอ C36 อ่านของร้านหนึ่งเรียงใหม่→เก่า M9 อ่านชุดเดียวกัน */
    index('reviews_restaurant_idx').on(t.restaurantId, t.createdAt),
    index('reviews_rider_idx').on(t.riderAccountId),
  ],
);
