import { describe, it, expect } from 'vitest';
import { createProofPath } from './proofPath';

const ok = async () => ({ status: 200, body: { path: 'delivery-proof/จากเซิร์ฟเวอร์.jpg' } });
const boom = async () => ({ status: 500, body: { message: 'Internal server error' } });

describe('ที่วางรูปยืนยันส่ง', () => {
  it('มี Storage ก็ใช้เส้นทางที่เซิร์ฟเวอร์ให้มา', async () => {
    const path = await createProofPath(ok, () => {})('order-1', 'tok');
    expect(path).toBe('delivery-proof/จากเซิร์ฟเวอร์.jpg');
  });

  it('ไม่มี Storage ก็ยังคืนเส้นทางที่ใช้ปิดงานได้ ไม่โยนทิ้ง', async () => {
    const path = await createProofPath(boom, () => {})('order-1', 'tok');
    expect(path).toBe('delivery-proof/order-1.jpg');
  });

  it('บอกครั้งเดียว แล้วเลิกยิงถามซ้ำทุกใบ', async () => {
    const lines: string[] = [];
    let calls = 0;
    const counted = async () => { calls += 1; return boom(); };
    const proofPath = createProofPath(counted, (l) => lines.push(l));

    for (const id of ['a', 'b', 'c']) await proofPath(id, 'tok');

    expect(calls).toBe(1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('500');
  });
});
