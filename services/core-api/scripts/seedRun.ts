/**
 * เดินคิวออเดอร์ของ seed แบบที่ใบเดียวสะดุดแล้วไม่ทิ้งงานทั้งรอบ
 *
 * job รีเซ็ตรายคืนเคยตายเพราะใบเดียวหาไรเดอร์ไม่ได้ ทิ้งงานที่เดินมาแล้วครึ่งชั่วโมง
 * ("ไม่มีใครรับใบ ... ทั้งรอบอัตโนมัติและการสั่งจ่ายเอง") ร้านบางร้านในฐานสาธิตอยู่ไกล
 * เกินกว่าที่เครื่องจ่ายงานจะเสนอให้ไรเดอร์ที่ยืนอยู่จุดเดียว ใบพวกนั้นจึงพลาดเป็นปกติ
 *
 * แยกออกมาจาก seedDemoHistory เพื่อให้เทสต์เรียกได้ตรง ๆ โดยไม่ต้องมี API หรือฐานข้อมูล
 */
export type QueueItem = { id: string; cancelled: boolean };

export type QueueDeps<T> = {
  walk: (item: T) => Promise<void>;
  cancel: (item: T) => Promise<void>;
  log: (line: string) => void;
};

export async function runQueue<T extends QueueItem>(
  items: T[],
  deps: QueueDeps<T>,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await deps.walk(item);
      delivered += 1;
    } catch (error) {
      deps.log(`  ใบ ${item.id.slice(0, 8)} เดินสถานะไม่จบ — ${(error as Error).message}`);
      // ยกเป็นใบยกเลิกก่อนสั่งจริง ถ้าสั่งไม่ผ่านก็ยังต้องไม่ถูกนับเป็นใบที่ส่งถึง
      item.cancelled = true;
      failed += 1;
      try {
        await deps.cancel(item);
      } catch (cancelError) {
        deps.log(`  ยกเลิกใบ ${item.id.slice(0, 8)} ไม่ผ่านด้วย — ${(cancelError as Error).message}`);
      }
    }
  }

  return { delivered, failed };
}

/** ของน้อยเกินไปทำให้ค่ากลางกับอัตราต่าง ๆ อ่านเพี้ยน ซึ่งคือปัญหาที่สคริปต์นี้เกิดมาเพื่อแก้ */
export function assertEnough(delivered: number, target: number, minRate: number): void {
  if (delivered < target * minRate) {
    throw new Error(`ส่งถึงแค่ ${delivered} ใบ จากเป้า ${target} น้อยเกินกว่าจะเอาไปคำนวณตัวเลขได้`);
  }
}
