/**
 * ยิงงานพร้อมกันได้ไม่เกินจำนวนที่กำหนด
 *
 * ใช้กับขั้นตอนของ seed ที่แต่ละใบไม่ยุ่งกันเลย (ตอนสั่ง ตอนรีวิว)
 * คำขอบน Vercel ตกใบละ 2-5 วินาที ยิงทีละใบจึงกินเวลาเป็นสิบนาทีโดยไม่จำเป็น
 * ส่วนขั้นเดินสถานะห้ามใช้ เพราะการจ่ายงานให้ไรเดอร์ต้องเรียงกันตาม §6.3
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
