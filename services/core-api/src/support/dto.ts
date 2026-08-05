import { z } from 'zod';

/** เปิดตั๋ว (design AD4) */
export const OpenTicketSchema = z.object({
  orderId: z.uuid().optional(),
  kind: z.enum(['order_problem', 'payment', 'account', 'other']),
  subject: z.string().trim().min(1, 'กรุณาใส่หัวข้อ').max(120),
  body: z.string().trim().min(1, 'กรุณาอธิบายเรื่องที่ต้องการให้ช่วย').max(2000),
});
export type OpenTicketInput = z.infer<typeof OpenTicketSchema>;

export const ReplySchema = z.object({
  body: z.string().trim().min(1, 'พิมพ์ข้อความก่อนส่ง').max(2000),
});
export type ReplyInput = z.infer<typeof ReplySchema>;
