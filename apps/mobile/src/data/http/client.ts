/**
 * ตัวห่อ fetch ตัวเดียวของแอป — ทุก request ไป core-api ผ่านทางนี้
 *
 * เหตุผลที่รวมไว้จุดเดียว: การแนบ token, การแปลง error ให้เป็นรูปเดียวกัน และ timeout
 * เป็นเรื่องที่ถ้าปล่อยให้แต่ละที่ทำเอง จะมีที่ใดที่หนึ่งลืมแล้วกลายเป็นบั๊กที่หายาก
 */

/** รูปร่าง error ที่ core-api ตอบกลับ — ตรงกับ ZodBody กับ exception ทั้งหมดฝั่งเซิร์ฟเวอร์ */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** ข้อความรายช่อง เอาไปแปะใต้ช่องที่ผิดได้ตรงช่อง */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** ตอบกลับไม่ถึงเซิร์ฟเวอร์เลย — เน็ตหลุด หรือเซิร์ฟเวอร์ไม่ได้เปิด */
  static offline(): ApiError {
    return new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ต');
  }
}

/**
 * ตัดที่ 15 วินาที — จอที่หมุนค้างไม่มีที่สิ้นสุดแย่กว่าการบอกว่าล้มเหลวแล้วให้กดใหม่
 * ยาวพอสำหรับเน็ตมือถือช้า ๆ ในไทย แต่ไม่นานจนผู้ใช้คิดว่าแอปค้าง
 */
const TIMEOUT_MS = 15_000;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** token ของเซสชัน — ไม่ส่ง = ยิงแบบไม่ล็อกอิน (ดูรายชื่อร้านได้) */
  token?: string | null;
};

export function createClient(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, '');

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      // ทั้ง abort และ network error มาลงที่นี่ — ผู้ใช้ทำอย่างเดียวกันคือกดลองใหม่
      throw ApiError.offline();
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : null;

    if (!res.ok) {
      throw new ApiError(
        res.status,
        typeof body?.message === 'string' ? body.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        body?.fields as Record<string, string> | undefined,
      );
    }

    return body as T;
  };
}

export type ApiClient = ReturnType<typeof createClient>;
