import {
  orderTotals, orderItemName, deliveryFeeOf,
  DELIVERY_BASE_SATANG, DELIVERY_PER_KM_SATANG, SERVICE_FEE,
} from '../../src/features/cart/pricing';
import { createMockRepos } from '../../src/data/mock';

/** ค่าส่งฝั่งแอปต้องคิดสูตรเดียวกับ `services/core-api/src/orders/pricing.ts` เป๊ะ */
describe('deliveryFeeOf', () => {
  it('ระยะไม่เกิน 1 กม. เท่ากับค่าเริ่มต้น', () => {
    expect(deliveryFeeOf(0)).toBe(DELIVERY_BASE_SATANG);
    expect(deliveryFeeOf(0.4)).toBe(DELIVERY_BASE_SATANG);
    expect(deliveryFeeOf(1)).toBe(DELIVERY_BASE_SATANG);
  });

  it('เกิน 1 กม. คิดเพิ่มเป็นกิโล ปัดขึ้น', () => {
    // ปัดขึ้นเป็นกิโลเพราะลูกค้าต้องเดาราคาถูกก่อนกดสั่ง ราคาที่ขยับตามทศนิยมของ GPS
    expect(deliveryFeeOf(1.1)).toBe(DELIVERY_BASE_SATANG + DELIVERY_PER_KM_SATANG);
    expect(deliveryFeeOf(2)).toBe(DELIVERY_BASE_SATANG + DELIVERY_PER_KM_SATANG);
    expect(deliveryFeeOf(2.01)).toBe(DELIVERY_BASE_SATANG + 2 * DELIVERY_PER_KM_SATANG);
  });

  it('ระยะที่ยังไม่รู้ใช้ราคาต่ำสุด — จอเป็นคนบอกว่ามันคือ "เริ่มต้นที่"', () => {
    expect(deliveryFeeOf(null)).toBe(DELIVERY_BASE_SATANG);
  });

  it('ทุกผลลัพธ์เป็นจำนวนเต็มสตางค์', () => {
    for (const km of [0, 0.3, 1, 1.4, 3.7, 4.99]) {
      expect(Number.isInteger(deliveryFeeOf(km))).toBe(true);
    }
  });
});

describe('orderTotals', () => {
  it('แยกสามค่าและรวมถูก', () => {
    const t = orderTotals(10000, 0.6);
    expect(t).toEqual({
      foodTotal: 10000,
      deliveryFee: DELIVERY_BASE_SATANG,
      serviceFee: SERVICE_FEE,
      grandTotal: 12000,
    });
  });

  it('ร้านไกลขึ้นแล้วยอดรวมขึ้นตาม', () => {
    const near = orderTotals(10000, 0.6);
    const far = orderTotals(10000, 3.2);
    expect(far.deliveryFee).toBe(near.deliveryFee + 3 * DELIVERY_PER_KM_SATANG);
    expect(far.grandTotal).toBe(near.grandTotal + 3 * DELIVERY_PER_KM_SATANG);
  });
});

describe('ยอดที่จอคาดการณ์ต้องตรงกับใบที่ออกจริง', () => {
  /** นี่คือบั๊กที่เทสต์ชุดนี้มีไว้กัน: ฝั่งจอกับฝั่งที่ออกใบคิดคนละสูตร */
  it('ร้านห่างเกิน 1 กม. คิดค่าส่งเท่ากันทั้งสองฝั่ง', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');

    const shop = (await repos.catalog.listRestaurants()).find((r) => r.id === 'r-somtam')!;
    expect(shop.distanceKm).toBeGreaterThan(1);

    const order = await repos.orders.create({
      restaurantId: 'r-somtam',
      items: [{ menuItemId: 'm-somtam-1', quantity: 1, choiceIds: ['c-st1-2'] }],
      paymentMethod: 'promptpay',
    });

    const preview = orderTotals(order.foodTotal, shop.distanceKm);
    expect(order.deliveryFee).toBe(preview.deliveryFee);
    expect(order.deliveryFee).toBe(DELIVERY_BASE_SATANG + DELIVERY_PER_KM_SATANG);
  });

  it('ซูเปอร์แอดมินเปลี่ยนค่าธรรมเนียมแล้วใบใหม่คิดตามค่าใหม่', async () => {
    const repos = createMockRepos();
    await repos.auth.login('super_root', '1234');
    await repos.super.setPricing({
      commissionRateBp: 1500,
      deliveryBaseSatang: 2000,
      deliveryPerKmSatang: 600,
      serviceFeeSatang: 700,
    });

    await repos.auth.login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });

    // r-malee อยู่ 0.6 กม. จึงจ่ายแค่ค่าเริ่มต้นตัวใหม่
    expect(order.deliveryFee).toBe(2000);
    expect(order.serviceFee).toBe(700);
  });
});

describe('orderItemName', () => {
  it('ไม่มี option → ชื่อเดิม', () => {
    expect(orderItemName('ข้าวกะเพรา', [])).toBe('ข้าวกะเพรา');
  });
  it('มี option → ต่อท้ายในวงเล็บ', () => {
    expect(orderItemName('ข้าวกะเพรา', [{ name: 'ไข่ดาว' }, { name: 'เผ็ดมาก' }])).toBe('ข้าวกะเพรา (ไข่ดาว, เผ็ดมาก)');
  });
});
