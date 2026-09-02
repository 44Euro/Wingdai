/**
 * ยิงซ้ำเมื่อคำขอล้มระดับเน็ตเวิร์ก ไม่ใช่ระดับ HTTP
 *
 * สคริปต์ seed ยิงหลายร้อยคำขอเรียงกัน สะดุดครั้งเดียวก็ล้มทั้งรอบ
 * และเกิดขึ้นจริงแล้ว — job รีเซ็ตรายคืนตายที่ `fetch failed` หลัง db:reset
 * เพราะ API บน Vercel รีสตาร์ตตัวเองตอนคอนเนกชันในพูลตายพร้อมกันทั้งชุด
 *
 * ยิงซ้ำเฉพาะที่ปลอดภัยจะยิงซ้ำ คือคำขอที่ยังไปไม่ถึงเซิร์ฟเวอร์
 * ส่วน error ที่มาจากกติกาธุรกิจ (409 ซ้ำ · 400 ผิดกติกา) โยนออกทันที
 */
const NETWORK_HINTS = [
  'fetch failed', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN',
  'socket hang up', 'network', 'terminated',
];

function isNetworkError(error: unknown): boolean {
  const text = `${(error as Error)?.message ?? ''} ${(error as { cause?: { code?: string } })?.cause?.code ?? ''}`;
  return NETWORK_HINTS.some((hint) => text.toLowerCase().includes(hint.toLowerCase()));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const delayMs = opts.delayMs ?? 1500;

  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts || !isNetworkError(error)) throw error;
      console.log(`  เน็ตสะดุด (${(error as Error).message}) ลองใหม่ครั้งที่ ${i + 1}/${attempts}`);
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
}
