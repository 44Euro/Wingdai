import { describe, it, expect } from 'vitest';
import { canSetStatus, assertCanSetStatus, type Actor } from './authorize';
import type { OrderStatus } from './stateMachine';

const ACTORS: Actor[] = ['customer', 'restaurantOwner', 'rider', 'admin', 'stranger'];
const STATUSES: OrderStatus[] = ['accepted', 'preparing', 'picked_up', 'delivered', 'cancelled'];

describe('ใครเปลี่ยนสถานะออร์เดอร์เป็นอะไรได้', () => {
  it('คนที่ไม่เกี่ยวข้องทำอะไรไม่ได้เลย', () => {
    for (const s of STATUSES) {
      expect(canSetStatus('stranger', s), s).toBe(false);
    }
  });

  /**
   * ข้อที่สำคัญที่สุด — `delivered` เขียน ledger จริง (claude.md §6.2)
   * ถ้าลูกค้ากดเองได้ จะสร้างรายการบัญชีปลอมของออร์เดอร์ตัวเองได้ทันที
   */
  it('มีแต่ไรเดอร์ที่รับงานแล้วกับแอดมินที่กด delivered ได้', () => {
    const allowed = ACTORS.filter((a) => canSetStatus(a, 'delivered'));
    expect(allowed.sort()).toEqual(['admin', 'rider']);
  });

  it('มีแต่ไรเดอร์กับแอดมินที่กดรับของแล้วได้', () => {
    expect(ACTORS.filter((a) => canSetStatus(a, 'picked_up')).sort()).toEqual(['admin', 'rider']);
  });

  it('ร้านเป็นคนรับออร์เดอร์และบอกว่ากำลังทำ — ลูกค้ากับไรเดอร์ทำแทนไม่ได้', () => {
    for (const s of ['accepted', 'preparing'] as const) {
      expect(canSetStatus('restaurantOwner', s), s).toBe(true);
      expect(canSetStatus('customer', s), s).toBe(false);
      expect(canSetStatus('rider', s), s).toBe(false);
    }
  });

  it('ลูกค้ายกเลิกได้อย่างเดียว', () => {
    expect(canSetStatus('customer', 'cancelled')).toBe(true);
    const others = STATUSES.filter((s) => s !== 'cancelled');
    for (const s of others) {
      expect(canSetStatus('customer', s), s).toBe(false);
    }
  });

  /** §6.3 กำหนดให้แอดมินมีทางแทรกมือเมื่อระบบจ่ายงานพลาด */
  it('แอดมินทำได้ทุกสถานะ', () => {
    for (const s of STATUSES) {
      expect(canSetStatus('admin', s), s).toBe(true);
    }
  });

  it('ที่ทำไม่ได้ต้องโยน error ไม่ใช่ปล่อยผ่านเงียบ ๆ', () => {
    expect(() => assertCanSetStatus('customer', 'delivered')).toThrow();
    expect(() => assertCanSetStatus('rider', 'delivered')).not.toThrow();
  });
});
