import { z } from 'zod';

/** เขียนรีวิว (design C11) */
export const WriteReviewSchema = z.object({
  restaurantRating: z.number().int().min(1, 'ให้ดาวร้านอย่างน้อย 1 ดาว').max(5),
  /** ไม่ให้คะแนนไรเดอร์ก็ได้ ใบที่วางไว้หน้าประตูลูกค้าไม่ได้เจอเขาเลย */
  riderRating: z.number().int().min(1).max(5).nullish(),
  comment: z.string().trim().max(1000).nullish(),
  /** เส้นทางในบักเก็ต `public-media` ที่อัปขึ้นไปก่อนแล้ว ไม่ใช่ไฟล์ที่ส่งมาตรงนี้ */
  photoPaths: z.array(z.string().trim().min(1)).max(4).default([]),
});
export type WriteReviewInput = z.infer<typeof WriteReviewSchema>;
