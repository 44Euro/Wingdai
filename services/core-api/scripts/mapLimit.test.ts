import { describe, it, expect } from 'vitest';
import { mapLimit } from './mapLimit';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ยิงพร้อมกันแบบจำกัดจำนวน', () => {
  it('ผลลัพธ์เรียงตามลำดับที่ส่งเข้าไป ไม่ใช่ตามลำดับที่เสร็จ', async () => {
    const out = await mapLimit([30, 10, 20], 3, async (ms) => {
      await tick(ms);
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it('ไม่ยิงเกินโควตาที่ตั้งไว้', async () => {
    let now = 0;
    let peak = 0;
    await mapLimit([...Array(12).keys()], 4, async () => {
      now += 1;
      peak = Math.max(peak, now);
      await tick(5);
      now -= 1;
    });
    expect(peak).toBe(4);
  });

  it('ทำครบทุกตัวถึงจะคืนค่า', async () => {
    const done: number[] = [];
    await mapLimit([...Array(9).keys()], 3, async (n) => {
      await tick(n % 3);
      done.push(n);
    });
    expect(done).toHaveLength(9);
  });

  it('รายการว่างไม่ต้องเรียก fn เลย', async () => {
    let calls = 0;
    expect(await mapLimit([], 4, async () => { calls += 1; })).toEqual([]);
    expect(calls).toBe(0);
  });

  it('ตัวใดตัวหนึ่งพัง ต้องโยนออกมา ไม่กลืนเงียบ', async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('ใบที่สองพัง');
        return n;
      }),
    ).rejects.toThrow('ใบที่สองพัง');
  });
});
