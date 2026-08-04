import { DELAYED_AFTER_MINUTES, isDelayed, isUnassigned, matchesFilter } from '../../src/lib/adminOrders';
import { commissionOf, COMMISSION_RATE_BP } from '../../src/lib/commission';
import type { AdminOrderRow } from '../../src/data/types';

function row(over: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: 'o-1',
    reference: 'WD-ABC123',
    status: 'preparing',
    restaurantName: 'ครัวมาลี',
    dropoffLabel: 'บ้าน',
    riderName: null,
    grandTotalSatang: 17000,
    createdAt: '2026-08-04T03:00:00.000Z',
    minutesElapsed: 5,
    ...over,
  };
}

/** กฎชุดนี้ซ้ำกับ services/core-api/src/orders/adminOrders.ts โดยเจตนา */
describe('ตัวกรองจอเฝ้าออร์เดอร์ (AD2)', () => {
  it('เกินเกณฑ์แล้วช้า ที่เกณฑ์พอดียังไม่ช้า', () => {
    expect(isDelayed(row({ minutesElapsed: DELAYED_AFTER_MINUTES + 1 }))).toBe(true);
    expect(isDelayed(row({ minutesElapsed: DELAYED_AFTER_MINUTES }))).toBe(false);
  });

  it('ออร์เดอร์ที่จบแล้วไม่เคยนับว่าช้าหรือไม่มีไรเดอร์', () => {
    expect(isDelayed(row({ status: 'delivered', minutesElapsed: 999 }))).toBe(false);
    expect(isDelayed(row({ status: 'cancelled', minutesElapsed: 999 }))).toBe(false);
    expect(isUnassigned(row({ status: 'cancelled', riderName: null }))).toBe(false);
  });

  it('ยังวิ่งอยู่และไม่มีไรเดอร์ = ต้องหาคนให้', () => {
    expect(isUnassigned(row({ riderName: null }))).toBe(true);
    expect(isUnassigned(row({ riderName: 'อรรถ' }))).toBe(false);
  });

  it('ตัวกรองสามค่าให้ผลต่างกันจริง', () => {
    const all = [
      row({ id: 'a', minutesElapsed: 3, riderName: 'อรรถ' }),
      row({ id: 'b', minutesElapsed: 40, riderName: 'อรรถ' }),
      row({ id: 'c', minutesElapsed: 3, riderName: null }),
      row({ id: 'd', status: 'delivered', minutesElapsed: 90, riderName: 'อรรถ' }),
    ];
    expect(all.filter((r) => matchesFilter('all', r)).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(all.filter((r) => matchesFilter('delayed', r)).map((r) => r.id)).toEqual(['b']);
    expect(all.filter((r) => matchesFilter('unassigned', r)).map((r) => r.id)).toEqual(['c']);
  });
});

describe('ค่าคอมมิชชัน (§6.1)', () => {
  it('15% ของค่าอาหาร', () => {
    expect(COMMISSION_RATE_BP).toBe(1500);
    expect(commissionOf(15000)).toBe(2250); // ฿150 → ฿22.50
  });

  /** เคยมีสองสูตรใน repo จำลอง (`floor` กับ `round`) ซึ่งต่างกัน 1 สตางค์ที่ยอดแบบนี้ */
  it('ปัดลงเสมอ เศษตกเป็นของร้าน', () => {
    expect(commissionOf(10)).toBe(1); // 1.5 → 1 ไม่ใช่ 2
    expect(commissionOf(30)).toBe(4); // 4.5 → 4 ไม่ใช่ 5
  });

  it('ผลลัพธ์เป็นจำนวนเต็มสตางค์เสมอ (§5 กติกาข้อ 1)', () => {
    for (const amount of [1, 7, 99, 12345, 1000000]) {
      expect(Number.isInteger(commissionOf(amount))).toBe(true);
    }
  });
});
