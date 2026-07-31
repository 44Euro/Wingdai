import { z } from 'zod';

export const OpenCaseSchema = z.object({
  orderId: z.uuid(),
  reason: z.enum([
    'wrong_item', 'missing_item', 'food_quality', 'damaged', 'not_delivered', 'late', 'other',
  ]),
  detail: z.string().trim().min(1, 'กรุณาอธิบายปัญหาที่เจอ').max(500),
  /** path ใน Supabase Storage — ยังไม่มีการอัปโหลดจริงในคลื่นนี้ */
  photoPath: z.string().trim().max(300).optional(),
  hasPhoto: z.boolean().default(false),
});
export type OpenCaseInput = z.infer<typeof OpenCaseSchema>;

/**
 * แอดมินยืนยัน / แก้ยอด / ปฏิเสธ
 *
 * `amountSatang` กับ `fault` ไม่ใส่มาก็ได้ = ใช้ตามที่ระบบเสนอ (§6.4 "ยืนยันด้วยการกดครั้งเดียว")
 * ใส่มาคือแอดมินแก้ ซึ่งต้องทำได้เช่นกัน
 */
export const DecideCaseSchema = z.object({
  approve: z.boolean(),
  amountSatang: z.number().int('ยอดต้องเป็นสตางค์จำนวนเต็ม').positive().optional(),
  fault: z.enum(['restaurant', 'rider', 'platform']).optional(),
});
export type DecideCaseInput = z.infer<typeof DecideCaseSchema>;
