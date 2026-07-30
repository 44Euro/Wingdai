import { z } from 'zod';

/** แอปส่งมาแค่ "อยากได้อะไร" ไม่ได้ส่งราคา เซิร์ฟเวอร์เป็นคนตีราคาจากเมนูในฐานเอง */
export const CreateOrderSchema = z.object({
  restaurantId: z.uuid(),
  items: z
    .array(
      z.object({
        menuItemId: z.uuid(),
        quantity: z.number().int().min(1).max(50),
        /** id ของตัวเลือกที่เลือก (ระดับเผ็ด ท็อปปิ้ง) เซิร์ฟเวอร์เทียบกับกลุ่มตัวเลือกของเมนูเอง */
        choiceIds: z.array(z.string()).default([]),
        /** ข้อความฝากถึงร้านสำหรับจานนี้ เช่น "ไม่ใส่ผักชี" */
        note: z.string().trim().max(140).optional(),
      }),
    )
    .min(1, 'ตะกร้าว่าง'),
  /** ช่องทางไหน "เปิดอยู่" จริงเป็นเรื่องของ feature flag ไม่ใช่ของ schema */
  paymentMethod: z.enum(['promptpay', 'cash', 'card']),
  /** ไม่ส่งมา = ใช้ที่อยู่แรกที่บันทึกไว้ */
  deliveryAddressId: z.uuid().optional(),
  /** ลูกค้าขอให้วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
  leaveAtDoor: z.boolean().default(false),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const UpdateStatusSchema = z.object({
  status: z.enum(['accepted', 'preparing', 'picked_up', 'delivered', 'cancelled']),
  /** รหัสยืนยันสี่หลักที่ลูกค้าบอกไรเดอร์ (design R11) */
  deliveryPin: z.string().regex(/^[0-9]{4}$/, 'รหัสยืนยันต้องเป็นตัวเลขสี่หลัก').optional(),
  /** เส้นทางรูปยืนยันส่งในบักเก็ต rider-docs */
  photoPath: z.string().trim().max(300).optional(),
  /** เหตุผลที่ปฏิเสธ (design M12) service บังคับว่าร้านต้องส่งมาเสมอตอนยกเลิก */
  reason: z.enum(['out_of_stock', 'too_busy', 'closing_soon', 'other']).optional(),
});
export type CancelReason = z.infer<typeof UpdateStatusSchema>['reason'];
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

/** product-spec §7 ที่อยู่ต้องมีพิกัด เพราะระยะทางกับการจ่ายงานคิดจากพิกัด ไม่ใช่จากข้อความ */
export const CreateAddressSchema = z.object({
  label: z.string().trim().min(1, 'กรุณาตั้งชื่อที่อยู่').max(40),
  addressText: z.string().trim().min(1, 'กรุณากรอกที่อยู่').max(300),
  note: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;

/** ทิปให้ไรเดอร์ (design C11) */
export const TipSchema = z.object({
  amountSatang: z.number().int('ยอดทิปต้องเป็นจำนวนเต็มสตางค์').positive('ยอดทิปต้องมากกว่าศูนย์'),
});
export type TipInput = z.infer<typeof TipSchema>;
