import { z } from 'zod';

export const ListOrdersQuerySchema = z.object({
  restaurantId: z.uuid().optional(),
  /** queue = ใบที่ครัวยังต้องทำต่อ · history = ใบที่ออกจากมือร้านไปแล้ว */
  scope: z.enum(['queue', 'history']).default('queue'),
});
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;

export const SetOpenSchema = z.object({ isOpen: z.boolean() });
export type SetOpenInput = z.infer<typeof SetOpenSchema>;

const OptionGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  minSelect: z.number().int().min(0).max(20),
  maxSelect: z.number().int().min(1).max(20),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(60),
        /** สตางค์จำนวนเต็ม และห้ามติดลบ — ตัวเลือกที่ "ลดราคา" คือส่วนลดแฝง ซึ่ง §3 ข้อ 3 ห้ามไว้ */
        priceDelta: z.number().int().min(0).max(100_000),
      }),
    )
    .min(1)
    .max(30),
});

/**
 * ราคาเป็นสตางค์จำนวนเต็มเสมอ (claude.md §5 กติกาข้อ 1)
 * `.int()` ตรงนี้คือด่านที่กัน 50.5 สตางค์ไม่ให้เข้าฐาน ซึ่งจะทำให้คอมมิชชัน 15% ปัดเศษเพี้ยน
 */
export const CreateMenuItemSchema = z.object({
  restaurantId: z.uuid(),
  name: z.string().trim().min(1, 'กรุณาตั้งชื่อเมนู').max(80),
  description: z.string().trim().max(300).optional(),
  price: z.number().int('ราคาต้องเป็นสตางค์จำนวนเต็ม').min(1).max(10_000_000),
  category: z.enum(['rice', 'noodle', 'somtam', 'drink', 'dessert']),
  isAvailable: z.boolean().default(true),
  optionGroups: z.array(OptionGroupSchema).max(10).optional(),
});
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;

export const UpdateMenuItemSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300),
    price: z.number().int('ราคาต้องเป็นสตางค์จำนวนเต็ม').min(1).max(10_000_000),
    isAvailable: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'ไม่มีอะไรให้แก้' });
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemSchema>;
