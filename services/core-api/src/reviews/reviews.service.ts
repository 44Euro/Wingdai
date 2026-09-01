import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { reviews, orders, accounts, restaurants, orderItems } from '../db/schema';
import { StorageService } from '../storage/storage.service';
import { assertCanReview, summarise, type RatingBreakdown } from './eligibility';
import type { WriteReviewInput } from './dto';

export type ReviewRow = {
  id: string;
  orderId: string;
  authorName: string;
  restaurantRating: number;
  riderRating: number | null;
  comment: string | null;
  /** URL เต็มที่เปิดได้เลย จอไม่ควรต้องรู้ว่าบักเก็ตชื่ออะไรหรือประกอบ URL ยังไง */
  photoUrls: string[];
  /** ชื่อจานแรกของออเดอร์ ดีไซน์ C36 โชว์ "2 days ago Krapow Moo Sap" */
  itemName: string | null;
  createdAt: string;
};

export type ReviewSummary = {
  average: number | null;
  count: number;
  breakdown: RatingBreakdown;
  reviews: ReviewRow[];
};

/** รีวิว (design C11 C36 M9) */
@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async write(accountId: string, orderId: string, input: WriteReviewInput) {
    const [order] = await this.db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        restaurantId: orders.restaurantId,
        riderId: orders.riderId,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) throw new NotFoundException({ message: 'ไม่พบออเดอร์นี้' });

    const [existing] = await this.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);

    assertCanReview({
      viewerId: accountId,
      order: { customerId: order.customerId, status: order.status },
      alreadyReviewed: !!existing,
    });

    const [row] = await this.db
      .insert(reviews)
      .values({
        orderId,
        authorAccountId: accountId,
        restaurantId: order.restaurantId,
        // ให้คะแนนไรเดอร์ได้ต่อเมื่อใบนั้นมีไรเดอร์จริง ไม่งั้นคะแนนลอยไม่มีเจ้าของ
        riderAccountId: input.riderRating != null ? order.riderId : null,
        restaurantRating: input.restaurantRating,
        riderRating: order.riderId ? input.riderRating ?? null : null,
        comment: input.comment?.trim() || null,
        photoPaths: input.photoPaths,
      })
      .returning();

    return this.toRow(row!, null, null);
  }

  /** รีวิวของออเดอร์ใบเดียว จอ C11 ใช้เช็คว่ารีวิวไปแล้วหรือยัง */
  async forOrder(orderId: string): Promise<ReviewRow | null> {
    const [row] = await this.db.select().from(reviews).where(eq(reviews.orderId, orderId)).limit(1);
    if (!row) return null;
    const [author] = await this.db
      .select({ fullName: accounts.fullName })
      .from(accounts)
      .where(eq(accounts.id, row.authorAccountId))
      .limit(1);
    return this.toRow(row, author?.fullName ?? null, null);
  }

  /** สรุป + รายการรีวิวของร้านหนึ่ง (design C36 M9 ใช้ตัวเดียวกัน) */
  async forRestaurant(restaurantId: string): Promise<ReviewSummary> {
    const [shop] = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);
    if (!shop) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });

    const rows = await this.db
      .select({ review: reviews, authorName: accounts.fullName })
      .from(reviews)
      .innerJoin(accounts, eq(accounts.id, reviews.authorAccountId))
      .where(eq(reviews.restaurantId, restaurantId))
      .orderBy(desc(reviews.createdAt));

    const itemNames = await this.firstItemNames(rows.map((r) => r.review.orderId));
    const summary = summarise(rows.map((r) => r.review.restaurantRating));

    return {
      ...summary,
      reviews: rows.map((r) =>
        this.toRow(r.review, r.authorName, itemNames.get(r.review.orderId) ?? null),
      ),
    };
  }

  /** ชื่อจานแรกของแต่ละออเดอร์ ดึงทีเดียวทั้งชุด ไม่ใช่ยิงทีละใบในลูป */
  private async firstItemNames(orderIds: string[]): Promise<Map<string, string>> {
    if (orderIds.length === 0) return new Map();
    const rows = await this.db
      .select({ orderId: orderItems.orderId, name: orderItems.name })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const out = new Map<string, string>();
    for (const r of rows) if (!out.has(r.orderId)) out.set(r.orderId, r.name);
    return out;
  }

  private toRow(
    row: typeof reviews.$inferSelect,
    authorName: string | null,
    itemName: string | null,
  ): ReviewRow {
    return {
      id: row.id,
      orderId: row.orderId,
      authorName: authorName ?? '',
      restaurantRating: row.restaurantRating,
      riderRating: row.riderRating,
      comment: row.comment,
      photoUrls: row.photoPaths.map((p) => this.storage.publicUrl(p)),
      itemName,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** คะแนนเฉลี่ยของหลายร้านพร้อมกัน catalog เรียกตอนวาดรายการร้าน */
  async averagesFor(restaurantIds: string[]): Promise<Map<string, number>> {
    if (restaurantIds.length === 0) return new Map();
    const rows = await this.db
      .select({ restaurantId: reviews.restaurantId, rating: reviews.restaurantRating })
      .from(reviews)
      .where(inArray(reviews.restaurantId, restaurantIds));

    const byShop = new Map<string, number[]>();
    for (const r of rows) {
      const list = byShop.get(r.restaurantId) ?? [];
      list.push(r.rating);
      byShop.set(r.restaurantId, list);
    }

    const out = new Map<string, number>();
    for (const [id, ratings] of byShop) {
      const avg = summarise(ratings).average;
      if (avg !== null) out.set(id, avg);
    }
    return out;
  }

  /** รีวิวที่ร้านของฉันได้รับ (design M9) service เช็คว่าร้านนี้เป็นของคนเรียกจริง */
  async forMyRestaurant(ownerId: string, restaurantId: string): Promise<ReviewSummary> {
    const [shop] = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(and(eq(restaurants.id, restaurantId), eq(restaurants.ownerUserId, ownerId)))
      .limit(1);
    // ตอบ 404 ไม่ใช่ 403 ไม่ยืนยันว่าร้านรหัสนี้มีอยู่จริงให้คนที่ไม่ใช่เจ้าของ
    if (!shop) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    return this.forRestaurant(restaurantId);
  }
}
