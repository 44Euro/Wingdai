import { z } from 'zod';

/**
 * แอปส่งมาแค่ "อยากได้อะไร" ไม่ได้ส่งราคา — เซิร์ฟเวอร์เป็นคนตีราคาจากเมนูในฐานเอง
 * ถ้ารับราคาจากแอป คนที่แก้แอปจะสั่งของแพงในราคาถูกได้ และคอมมิชชัน 15% (§6.1) จะเพี้ยนตาม
 */
export const CreateOrderSchema = z.object({
  restaurantId: z.uuid(),
  items: z
    .array(
      z.object({
        menuItemId: z.uuid(),
        quantity: z.number().int().min(1).max(50),
        /** id ของตัวเลือกที่เลือก (ระดับเผ็ด ท็อปปิ้ง) — เซิร์ฟเวอร์เทียบกับกลุ่มตัวเลือกของเมนูเอง */
        choiceIds: z.array(z.string()).default([]),
      }),
    )
    .min(1, 'ตะกร้าว่าง'),
  paymentMethod: z.enum(['promptpay', 'cash']),
  /** ไม่ส่งมา = ใช้ที่อยู่แรกที่บันทึกไว้ */
  deliveryAddressId: z.uuid().optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const UpdateStatusSchema = z.object({
  status: z.enum(['accepted', 'preparing', 'picked_up', 'delivered', 'cancelled']),
});
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

/** claude.md §7 — ที่อยู่ต้องมีพิกัด เพราะระยะทางกับการจ่ายงานคิดจากพิกัด ไม่ใช่จากข้อความ */
export const CreateAddressSchema = z.object({
  label: z.string().trim().min(1, 'กรุณาตั้งชื่อที่อยู่').max(40),
  addressText: z.string().trim().min(1, 'กรุณากรอกที่อยู่').max(300),
  note: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
