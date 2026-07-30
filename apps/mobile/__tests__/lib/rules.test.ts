import {
  canOrderFromRestaurant,
  canRiderAcceptOrder,
  canPayNowWithPromptPay,
} from '../../src/lib/rules';
import type { Restaurant, Order } from '../../src/data/types';

const shop: Restaurant = {
  id: 'r1', ownerUserId: 'u1', name: 'ร้านสมชาย', isApproved: true, isOpen: true,
  cuisine: 'rice', distanceKm: 1, prepTimeMinutes: 10, rating: 4.5,
};

const order: Order = {
  id: 'o1', reference: 'WD-TEST01', customerId: 'u5', restaurantId: 'r1', status: 'accepted',
  items: [], foodTotal: 15000, deliveryFee: 1500, serviceFee: 500,
  paymentMethod: 'promptpay', paymentStatus: 'paid',
  createdAt: '2026-07-21T10:00:00Z',
};

/** ออร์เดอร์เงินสดที่ยังไม่ได้จ่าย — สถานะตั้งต้นของเคส "เงินสดไม่พอ" */
const cashOrder: Order = { ...order, paymentMethod: 'cash', paymentStatus: 'pending' };

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

describe('canPayNowWithPromptPay', () => {
  it('ออร์เดอร์เงินสดที่ยังไม่จ่าย เปลี่ยนไปพร้อมเพย์ได้', () => {
    expect(canPayNowWithPromptPay(cashOrder)).toBe(true);
  });

  it('ยังเปลี่ยนได้ตลอดจนถึงตอนไรเดอร์กำลังไปส่ง', () => {
    expect(canPayNowWithPromptPay({ ...cashOrder, status: 'picked_up' })).toBe(true);
  });

  it('ส่งถึงแล้วเปลี่ยนไม่ได้ — ถือว่าเก็บเงินสดไปแล้ว ต้องเข้ากระบวนการคืนเงินแทน', () => {
    expect(canPayNowWithPromptPay({ ...cashOrder, status: 'delivered' })).toBe(false);
  });

  it('ยกเลิกแล้วเปลี่ยนไม่ได้', () => {
    expect(canPayNowWithPromptPay({ ...cashOrder, status: 'cancelled' })).toBe(false);
  });

  it('ออร์เดอร์ที่จ่ายพร้อมเพย์อยู่แล้วไม่ต้องเปลี่ยนอะไร', () => {
    expect(canPayNowWithPromptPay(order)).toBe(false);
  });

  /** กันจ่ายซ้ำ ถ้าเผลอกดสองรอบหรือหน้าจอค้างอยู่บนอีกเครื่อง */
  it('เงินสดที่จ่ายไปแล้วกดจ่ายซ้ำไม่ได้', () => {
    expect(canPayNowWithPromptPay({ ...cashOrder, paymentStatus: 'paid' })).toBe(false);
  });
});
