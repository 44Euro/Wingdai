import { canOrderFromRestaurant, canRiderAcceptOrder } from '../../src/lib/rules';
import type { Restaurant, Order } from '../../src/data/types';

const shop: Restaurant = {
  id: 'r1', ownerUserId: 'u1', name: 'ร้านสมชาย', isApproved: true, isOpen: true,
  cuisine: 'rice', distanceKm: 1, prepTimeMinutes: 10, rating: 4.5,
};

const order: Order = {
  id: 'o1', customerId: 'u5', restaurantId: 'r1', status: 'accepted',
  items: [], foodTotal: 15000, deliveryFee: 1500, serviceFee: 500,
  createdAt: '2026-07-21T10:00:00Z',
};

describe('canOrderFromRestaurant', () => {
  it('เจ้าของร้านสั่งจากร้านตัวเองไม่ได้', () => {
    expect(canOrderFromRestaurant('u1', shop)).toBe(false);
  });

  it('คนอื่นสั่งได้', () => {
    expect(canOrderFromRestaurant('u2', shop)).toBe(true);
  });

  it('ร้านปิดอยู่สั่งไม่ได้', () => {
    expect(canOrderFromRestaurant('u2', { ...shop, isOpen: false })).toBe(false);
  });

  it('ร้านที่ยังไม่อนุมัติสั่งไม่ได้', () => {
    expect(canOrderFromRestaurant('u2', { ...shop, isApproved: false })).toBe(false);
  });
});

describe('canRiderAcceptOrder', () => {
  it('ไรเดอร์รับงานส่งออร์เดอร์ที่ตัวเองสั่งไม่ได้', () => {
    expect(canRiderAcceptOrder('u5', order)).toBe(false);
  });

  it('ไรเดอร์คนอื่นรับได้', () => {
    expect(canRiderAcceptOrder('u9', order)).toBe(true);
  });

  it('ออร์เดอร์ที่มีไรเดอร์แล้วรับซ้ำไม่ได้', () => {
    expect(canRiderAcceptOrder('u9', { ...order, riderId: 'u8' })).toBe(false);
  });
});
