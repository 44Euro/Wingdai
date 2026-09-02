import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './fetchRetry';

describe('ยิงซ้ำเมื่อเน็ตสะดุด', () => {
  it('สำเร็จรอบแรก ไม่ต้องยิงซ้ำ', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(fn, { delayMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('สะดุดสองครั้งแล้วติด ต้องได้ผลลัพธ์ ไม่ใช่ล้มทั้งรอบ', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue('ok');
    expect(await withRetry(fn, { delayMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('สะดุดทุกครั้งจนครบโควตา ต้องโยน error ตัวจริงออกมา', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(withRetry(fn, { delayMs: 0, attempts: 3 })).rejects.toThrow('fetch failed');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('error ที่ไม่ใช่เรื่องเน็ต ต้องโยนออกทันที ไม่ยิงซ้ำให้เสียเวลา', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ร้านรับ — ได้ 409'));
    await expect(withRetry(fn, { delayMs: 0 })).rejects.toThrow('409');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
