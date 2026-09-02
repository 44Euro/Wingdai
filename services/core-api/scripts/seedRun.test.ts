import { describe, it, expect } from 'vitest';
import { runQueue, assertEnough } from './seedRun';

type Row = { id: string; cancelled: boolean };
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `order-${i}`, cancelled: false }));

function spy() {
  const seen: string[] = [];
  return { seen, fn: async (o: Row) => { seen.push(o.id); } };
}

describe('เดินคิวออเดอร์แบบไม่ทิ้งงานทั้งรอบ', () => {
  it('ทุกใบผ่าน — ไม่มีการสั่งยกเลิก และไม่มีใบไหนถูกทำเครื่องหมายยกเลิก', async () => {
    const walk = spy();
    const cancel = spy();
    const items = rows(4);

    const out = await runQueue(items, { walk: walk.fn, cancel: cancel.fn, log: () => {} });

    expect(out).toEqual({ delivered: 4, failed: 0 });
    expect(walk.seen).toEqual(['order-0', 'order-1', 'order-2', 'order-3']);
    expect(cancel.seen).toEqual([]);
    expect(items.every((o) => !o.cancelled)).toBe(true);
  });

  it('ใบกลางคิวพัง — ใบที่เหลือต้องถูกเดินต่อจนครบ (บั๊กเดิมทิ้งงานทั้งรอบตรงนี้)', async () => {
    const cancel = spy();
    const walked: string[] = [];
    const items = rows(5);

    const out = await runQueue(items, {
      walk: async (o) => {
        walked.push(o.id);
        if (o.id === 'order-2') throw new Error('ไม่มีใครรับใบนี้');
      },
      cancel: cancel.fn,
      log: () => {},
    });

    expect(walked).toEqual(['order-0', 'order-1', 'order-2', 'order-3', 'order-4']);
    expect(out).toEqual({ delivered: 4, failed: 1 });
  });

  it('ใบที่พังต้องถูกสั่งยกเลิกด้วย id ของมันเอง และถูกทำเครื่องหมายไว้', async () => {
    const cancel = spy();
    const items = rows(3);

    await runQueue(items, {
      walk: async (o) => { if (o.id === 'order-1') throw new Error('พัง'); },
      cancel: cancel.fn,
      log: () => {},
    });

    expect(cancel.seen).toEqual(['order-1']);
    // ขั้นย้อนเวลาอ่านค่านี้ ถ้าไม่ตั้งจะไปใส่เวลาส่งถึงให้ใบที่ไม่เคยส่ง
    expect(items.map((o) => o.cancelled)).toEqual([false, true, false]);
  });

  it('การสั่งยกเลิกพังเอง ก็ยังต้องเดินใบที่เหลือต่อ', async () => {
    const items = rows(3);
    const out = await runQueue(items, {
      walk: async (o) => { if (o.id !== 'order-2') throw new Error('เดินไม่จบ'); },
      cancel: async () => { throw new Error('ยกเลิกก็ไม่ผ่าน'); },
      log: () => {},
    });

    expect(out).toEqual({ delivered: 1, failed: 2 });
    expect(items.map((o) => o.cancelled)).toEqual([true, true, false]);
  });

  it('บอกเหตุผลของทุกใบที่พังออกทางล็อก ไม่กลืนเงียบ', async () => {
    const lines: string[] = [];
    await runQueue(rows(2), {
      walk: async () => { throw new Error('ไม่มีใครรับใบนี้'); },
      cancel: async () => {},
      log: (l) => lines.push(l),
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('order-0');
    expect(lines[0]).toContain('ไม่มีใครรับใบนี้');
  });
});

describe('ด่านตัดสินว่าได้ของมากพอไหม', () => {
  it('พอดีเส้นถือว่าผ่าน', () => {
    expect(() => assertEnough(29, 36, 0.8)).not.toThrow();
  });

  it('ต่ำกว่าเส้นต้องโยน พร้อมบอกทั้งจำนวนจริงและเป้า', () => {
    expect(() => assertEnough(11, 36, 0.8)).toThrow(/11/);
    expect(() => assertEnough(11, 36, 0.8)).toThrow(/36/);
  });

  it('ครบทุกใบก็ต้องผ่าน', () => {
    expect(() => assertEnough(36, 36, 0.8)).not.toThrow();
  });
});
