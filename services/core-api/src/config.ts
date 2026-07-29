import { z } from 'zod';

/**
 * ตรวจ env ตอนเปิดเซิร์ฟเวอร์ ไม่ใช่ตอนที่โค้ดวิ่งไปถึงจุดที่ใช้
 *
 * ถ้าลืมตั้ง JWT_SECRET แล้วรู้ตัวตอนมีคนกดล็อกอิน เท่ากับ deploy พังไปแล้ว
 * ล้มตั้งแต่ตอนบูตพร้อมบอกว่าตัวไหนขาด แก้ได้ใน 10 วินาที
 */
/**
 * ค่าที่ยังเป็นตัวอย่างจาก .env.example อ่านผ่านตาแล้วเหมือนตั้งค่าครบ
 * แต่พอรันจริงจะได้ error แปลก ๆ จากฝั่ง Supabase เช่น "tenant/user postgres.PROJECT_REF not found"
 * ซึ่งไม่มีอะไรชี้กลับมาว่าต้นเหตุอยู่ที่ .env — ดักไว้ตรงนี้แล้วบอกให้ชัดตั้งแต่ตอนบูต
 */
const PLACEHOLDERS = ['PROJECT_REF', 'YOUR-PASSWORD', 'YOUR_PASSWORD', 'PASSWORD@'];

const connectionString = z
  .string()
  .min(1)
  .refine(
    (v) => !PLACEHOLDERS.some((p) => v.includes(p)),
    'ยังเป็นค่าตัวอย่างจาก .env.example — ใส่ค่าจริงจาก Supabase หรือลบบรรทัดนี้ทิ้ง',
  );

const EnvSchema = z.object({
  DATABASE_URL: connectionString,
  /** ใช้ตอนรันจริง — pooler ทนคอนเนกชันเยอะกว่า ส่วน DATABASE_URL ไว้ทำ migration */
  DATABASE_POOL_URL: connectionString.optional(),

  /**
   * 32 ไบต์ขึ้นไป เพราะ HS256 ใช้กุญแจสั้นกว่าความยาว hash ได้ตามสเปก แต่ทำให้เดาง่ายขึ้นจริง
   * สร้างด้วย: openssl rand -base64 48
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET ต้องยาวอย่างน้อย 32 ตัว — สร้างด้วย openssl rand -base64 48'),

  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`ค่าใน .env ไม่ครบหรือไม่ถูกต้อง\n${lines.join('\n')}`);
  }
  return parsed.data;
}
