import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { OrderStatus } from '../orders/stateMachine';

/** ใครรีวิวออเดอร์ใบไหนได้ (design C11) แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพื่อเทสต์ได้โดยไม่ต้องมีฐาน */
export function assertCanReview(input: {
  viewerId: string;
  order: { customerId: string; status: OrderStatus };
  alreadyReviewed: boolean;
}): void {
  /** ตอบ 403 ไม่ใช่ 404 ตรงนี้ได้ เพราะกว่าจะมาถึงจุดนี้ต้องรู้ id ของออเดอร์อยู่แล้ว */
  if (input.order.customerId !== input.viewerId) {
    throw new ForbiddenException({ message: 'รีวิวได้เฉพาะออเดอร์ของตัวเอง' });
  }

  // ยังไม่ได้กินก็ยังไม่รู้ว่าอร่อยไหม และใบที่ยกเลิกไปแล้วไม่เคยมีอาหารให้ตัดสิน
  if (input.order.status !== 'delivered') {
    throw new BadRequestException({ message: 'รีวิวได้หลังจากได้รับอาหารแล้ว' });
  }

  if (input.alreadyReviewed) {
    throw new BadRequestException({ message: 'ออเดอร์นี้รีวิวไปแล้ว' });
  }
}

/** หนึ่งแถวของแท่งสรุปคะแนนบนจอ C36/M9 ห้าถึงหนึ่งดาว เรียงจากมากไปน้อย */
export type RatingBreakdown = { stars: 1 | 2 | 3 | 4 | 5; count: number }[];

/** สรุปคะแนนจากรายการดาวดิบ */
export function summarise(ratings: number[]): {
  average: number | null;
  count: number;
  breakdown: RatingBreakdown;
} {
  const breakdown = ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    count: ratings.filter((r) => r === stars).length,
  }));

  if (ratings.length === 0) return { average: null, count: 0, breakdown };

  // ปัดทศนิยมเดียว จอโชว์ "4.8" การเก็บ 4.799999 ไว้แล้วให้จอปัดเองทำให้สองจอปัดไม่ตรงกัน
  const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { average: Math.round(mean * 10) / 10, count: ratings.length, breakdown };
}
