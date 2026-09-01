import { z } from 'zod';

export const ListOrdersQuerySchema = z.object({
  restaurantId: z.uuid().optional(),
  /** queue = ใบที่ครัวยังต้องทำต่อ history = ใบที่ออกจากมือร้านไปแล้ว */
  scope: z.enum(['queue', 'history']).default('queue'),
});
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;

/** จอสรุปยอดขาย ไม่ระบุร้าน = รวมทุกร้านที่บัญชีนี้เป็นเจ้าของ */
export const SummaryQuerySchema = z.object({
  restaurantId: z.uuid().optional(),
});
export type SummaryQuery = z.infer<typeof SummaryQuerySchema>;

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
        /** สตางค์จำนวนเต็ม และห้ามติดลบ ตัวเลือกที่ "ลดราคา" คือส่วนลดแฝง ซึ่ง §3 ข้อ 3 ห้ามไว้ */
        priceDelta: z.number().int().min(0).max(100_000),
      }),
    )
    .min(1)
    .max(30),
});

/** ราคาเป็นสตางค์จำนวนเต็มเสมอ (product-spec §5 กติกาข้อ 1) */
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

/** ฟอร์มเปิดร้าน (product-spec §4.3 §7) */
export const RegisterRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาตั้งชื่อร้าน').max(80),
  cuisine: z.enum(['rice', 'noodle', 'somtam', 'drink', 'dessert']),
  addressText: z.string().trim().min(1, 'กรุณากรอกที่อยู่ร้าน').max(300),
  /** ต้องอยู่ในโซนที่เปิดให้บริการ เซิร์ฟเวอร์เช็คด้วย PostGIS ไม่ใช่เชื่อแอป */
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** §6.3 ใช้ seed การจ่ายงานตอนยังไม่มีข้อมูลย้อนหลัง ฐานมี CHECK ว่าอยู่ระหว่าง 1–120 */
  prepTimeMinutes: z.number().int().min(1).max(120),
  openingHours: z.record(z.string(), z.unknown()).optional(),
  /** §7 ชื่อบัญชีควรตรงกับชื่อเจ้าของ เป็นด่านกันบัญชีม้าเบื้องต้น */
  bankName: z.string().trim().min(1, 'กรุณากรอกธนาคาร').max(60),
  bankAccountNumber: z.string().trim().regex(/^[0-9-]{8,20}$/, 'เลขบัญชีไม่ถูกต้อง'),
  bankAccountName: z.string().trim().min(1, 'กรุณากรอกชื่อบัญชี').max(120),
});
export type RegisterRestaurantInput = z.infer<typeof RegisterRestaurantSchema>;

export const SetApprovalSchema = z.object({ approve: z.boolean() });
export type SetApprovalInput = z.infer<typeof SetApprovalSchema>;

/** ตารางเวลาเปิด-ปิด (design M11) */
const DayHoursSchema = z
  .object({
    open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาต้องเป็นรูปแบบ HH:MM'),
    close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาต้องเป็นรูปแบบ HH:MM'),
  })
  .nullable();

export const SetHoursSchema = z.object({
  hours: z.object({
    sun: DayHoursSchema, mon: DayHoursSchema, tue: DayHoursSchema, wed: DayHoursSchema,
    thu: DayHoursSchema, fri: DayHoursSchema, sat: DayHoursSchema,
  }),
});
export type SetHoursInput = z.infer<typeof SetHoursSchema>;

/** `0` = เลิกพักเดี๋ยวนี้ ปุ่ม "กลับมารับออเดอร์" ใช้ทางเดียวกับปุ่มพัก ไม่ต้องมีเส้นทางที่สอง */
export const PauseSchema = z.object({ minutes: z.number().int().min(0).max(120) });
export type PauseInput = z.infer<typeof PauseSchema>;
