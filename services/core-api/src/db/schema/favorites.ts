import { pgTable, uuid, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { restaurants } from './catalog';

/** ร้านที่ลูกค้ากดบันทึกไว้ (design C19) */
export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('favorites_one_per_restaurant').on(t.accountId, t.restaurantId),
    index('favorites_account_idx').on(t.accountId, t.createdAt),
  ],
);
