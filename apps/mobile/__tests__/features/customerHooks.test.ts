import { filterApproved, pickActiveOrder } from '../../src/features/customer/hooks';
import type { Order, Restaurant } from '../../src/data/types';

const r = (id: string, isApproved: boolean): Restaurant => ({
  id,
  ownerUserId: 'x',
  name: id,
  isApproved,
  isOpen: true,
  cuisine: 'rice',
  distanceKm: 1,
  prepTimeMinutes: 10,
  opensAt: null,
  rating: 4.5,
});

describe('filterApproved', () => {
  it('คืนเฉพาะร้านที่อนุมัติแล้ว', () => {
    const out = filterApproved([r('a', true), r('b', false), r('c', true)]);
    expect(out.map((x) => x.id)).toEqual(['a', 'c']);
  });
});

function makeOrder(id: string, status: Order['status'], createdAt: string): Order {
  return {
    id,
    reference: `WD-${id}`,
    customerId: 'u-1',
    leaveAtDoor: false,
    tipSatang: 0,
  cancelledBy: null,
  cancelReason: null,
    restaurantId: 'r-malee',
    status,
    items: [{ menuItemId: 'm-1', name: 'ข้าวกะเพรา', choiceNames: [], choiceIds: [], unitPrice: 5000, quantity: 1 }],
    restaurantLat: 13.7761,
    restaurantLng: 100.545,
    dropoffLat: 13.7815,
    dropoffLng: 100.545,
    riderLocation: null,
    foodTotal: 5000,
    deliveryFee: 1500,
    serviceFee: 500,
    paymentMethod: 'promptpay',
    paymentStatus: 'paid',
    createdAt,
  };
}

describe('pickActiveOrder', () => {
  it('ไม่มีออร์เดอร์เลย → undefined', () => {
    expect(pickActiveOrder([])).toBeUndefined();
  });

  it('มีแต่ออร์เดอร์ที่จบแล้ว → undefined (ปุ่มกลาง navbar ต้องไม่โผล่)', () => {
    expect(
      pickActiveOrder([
        makeOrder('o-1', 'delivered', '2026-07-28T01:00:00.000Z'),
        makeOrder('o-2', 'cancelled', '2026-07-28T02:00:00.000Z'),
      ]),
    ).toBeUndefined();
  });

  it('มีหลายใบที่ยังไม่จบ → เอาใบล่าสุด', () => {
    expect(
      pickActiveOrder([
        makeOrder('o-1', 'created', '2026-07-28T01:00:00.000Z'),
        makeOrder('o-2', 'picked_up', '2026-07-28T03:00:00.000Z'),
        makeOrder('o-3', 'accepted', '2026-07-28T02:00:00.000Z'),
      ])?.id,
    ).toBe('o-2');
  });

  it('ไม่สนใจใบที่จบแล้วแม้จะใหม่กว่า', () => {
    expect(
      pickActiveOrder([
        makeOrder('o-1', 'preparing', '2026-07-28T01:00:00.000Z'),
        makeOrder('o-2', 'delivered', '2026-07-28T09:00:00.000Z'),
      ])?.id,
    ).toBe('o-1');
  });
});
