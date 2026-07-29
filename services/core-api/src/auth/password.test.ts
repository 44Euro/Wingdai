import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, burnPasswordTime } from './password';

describe('การเก็บรหัสผ่าน', () => {
  it('hash แล้วต้องตรวจกลับได้', async () => {
    const h = await hashPassword('sawasdee1234');
    expect(await verifyPassword('sawasdee1234', h)).toBe(true);
  });

  it('รหัสผิดต้องไม่ผ่าน', async () => {
    const h = await hashPassword('sawasdee1234');
    expect(await verifyPassword('sawasdee1235', h)).toBe(false);
  });

  it('เป็น argon2id ไม่ใช่ตระกูลอื่น', async () => {
    expect(await hashPassword('sawasdee1234')).toMatch(/^\$argon2id\$/);
  });

  it('รหัสเดียวกันได้ hash ต่างกันทุกครั้ง — แปลว่ามี salt', async () => {
    const [a, b] = await Promise.all([hashPassword('sawasdee1234'), hashPassword('sawasdee1234')]);
    expect(a).not.toBe(b);
  });

  /**
   * เหตุผลหลักที่เลือก argon2id แทน bcrypt (ดูคอมเมนต์ใน password.ts)
   * bcrypt ตัดที่ 72 ไบต์ ซึ่งภาษาไทยกินตัวละ 3 ไบต์ — สองรหัสนี้จะกลายเป็นอันเดียวกัน
   */
  it('รหัสผ่านไทยยาวเกิน 72 ไบต์ไม่ถูกตัดทิ้ง', async () => {
    const base = 'รหัสผ่านภาษาไทยที่ยาวมากจนเกินเจ็ดสิบสองไบต์แน่นอนเลยจริง';
    expect(Buffer.byteLength(base, 'utf8')).toBeGreaterThan(72);
    const h = await hashPassword(`${base}ก`);
    expect(await verifyPassword(`${base}ข`, h)).toBe(false);
  });

  it('รหัสสั้นเกินไปถูกปฏิเสธตั้งแต่ตอน hash', async () => {
    await expect(hashPassword('1234')).rejects.toThrow(/8/);
  });

  it('hash ที่เสียหายในฐานคืน false ไม่ใช่โยน error', async () => {
    expect(await verifyPassword('sawasdee1234', 'ขยะที่ไม่ใช่ hash')).toBe(false);
  });

  it('burnPasswordTime ไม่โยน error และใช้เวลาใกล้เคียงการตรวจจริง', async () => {
    const h = await hashPassword('sawasdee1234');

    const t0 = performance.now();
    await verifyPassword('sawasdee1234', h);
    const real = performance.now() - t0;

    const t1 = performance.now();
    await burnPasswordTime('sawasdee1234');
    const burn = performance.now() - t1;

    // เทียบแบบหลวม ๆ — เจตนาคือกันเคสที่ burn คืนทันที (0ms) ซึ่งทำให้จับเวลาแยกได้
    expect(burn).toBeGreaterThan(real / 4);
  });
});
