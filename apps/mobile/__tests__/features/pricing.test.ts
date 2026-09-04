import { orderTotals, orderItemName, deliveryFeeOf, FALLBACK_PRICING } from '../../src/features/cart/pricing';
import { createMockRepos } from '../../src/data/mock';

const { deliveryBaseSatang: BASE, deliveryPerKmSatang: PER_KM, serviceFeeSatang: SERVICE } = FALLBACK_PRICING;

/** ค่าส่งฝั่งแอปต้องคิดสูตรเดียวกับ `services/core-api/src/orders/pricing.ts` เป๊ะ */
describe('deliveryFeeOf', () => {
  it('ระยะไม่เกิน 1 กม. เท่ากับค่าเริ่มต้น', () => {
    expect(deliveryFeeOf(0, FALLBACK_PRICING)).toBe(BASE);
    expect(deliveryFeeOf(0.4, FALLBACK_PRICING)).toBe(BASE);
    expect(deliveryFeeOf(1, FALLBACK_PRICING)).toBe(BASE);
  });

  it('เกิน 1 กม. คิดเพิ่มเป็นกิโล ปัดขึ้น', () => {
    // ปัดขึ้นเป็นกิโลเพราะลูกค้าต้องเดาราคาถูกก่อนกดสั่ง ราคาที่ขยับตามทศนิยมของ GPS
    expect(deliveryFeeOf(1.1, FALLBACK_PRICING)).toBe(BASE + PER_KM);
    expect(deliveryFeeOf(2, FALLBACK_PRICING)).toBe(BASE + PER_KM);
    expect(deliveryFeeOf(2.01, FALLBACK_PRICING)).toBe(BASE + 2 * PER_KM);
  });

  it('ระยะที่ยังไม่รู้ใช้ราคาต่ำสุด — จอเป็นคนบอกว่ามันคือ "เริ่มต้นที่"', () => {
    expect(deliveryFeeOf(null, FALLBACK_PRICING)).toBe(BASE);
  });

  it('ทุกผลลัพธ์เป็นจำนวนเต็มสตางค์', () => {
    for (const km of [0, 0.3, 1, 1.4, 3.7, 4.99]) {
      expect(Number.isInteger(deliveryFeeOf(km, FALLBACK_PRICING))).toBe(true);
    }
  });

  /**
   * §6.5 สูตรสองฝั่งเหมือนกันอยู่แล้ว ที่เคยหลุดคือ "ค่าที่ป้อนเข้าสูตร"
   * ฟังก์ชันต้องคิดจากราคาที่ส่งเข้ามา ไม่ใช่ค่าสำรองของตัวเอง
   */
  it('คิดตามราคาที่ส่งเข้ามา ไม่ใช่ค่าสำรองในโมดูล', () => {
    const changed = { deliveryBaseSatang: 2000, deliveryPerKmSatang: 900, serviceFeeSatang: 700 };

    expect(deliveryFeeOf(0.5, changed)).toBe(2000);
    expect(deliveryFeeOf(3.2, changed)).toBe(2000 + 3 * 900);
  });
});

describe('orderTotals', () => {
  it('แยกสามค่าและรวมถูก', () => {
    const t = orderTotals(10000, 0.6, FALLBACK_PRICING);
    expect(t).toEqual({
      foodTotal: 10000,
      deliveryFee: BASE,
      serviceFee: SERVICE,
      grandTotal: 12000,
    });
  });

  it('ร้านไกลขึ้นแล้วยอดรวมขึ้นตาม', () => {
    const near = orderTotals(10000, 0.6, FALLBACK_PRICING);
    const far = orderTotals(10000, 3.2, FALLBACK_PRICING);
    expect(far.deliveryFee).toBe(near.deliveryFee + 3 * PER_KM);
    expect(far.grandTotal).toBe(near.grandTotal + 3 * PER_KM);
  });

  it('ค่าบริการก็มาจากราคาที่ส่งเข้ามา ไม่ใช่ค่าคงที่', () => {
    const changed = { deliveryBaseSatang: 1500, deliveryPerKmSatang: 600, serviceFeeSatang: 700 };
    const t = orderTotals(10000, 0.6, changed);

    expect(t.serviceFee).toBe(700);
    expect(t.grandTotal).toBe(10000 + 1500 + 700);
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

    const preview = orderTotals(order.foodTotal, shop.distanceKm, FALLBACK_PRICING);
    expect(order.deliveryFee).toBe(preview.deliveryFee);
    expect(order.deliveryFee).toBe(BASE + PER_KM);
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

  /**
   * บั๊กที่รีวิวจับได้: สูตรตรงกันแต่ตะกร้าอ่านค่าคงที่ในโมดูล เซิร์ฟเวอร์อ่านจากฐาน
   * §6.5 เขียนเคสนี้ไว้เองว่า "แอปโชว์ ฿15 เซิร์ฟเวอร์เก็บ ฿21"
   */
  it('เปลี่ยนราคาแล้ว ราคาที่ /config ส่งให้ตะกร้าตรงกับใบที่ออกจริง', async () => {
    const repos = createMockRepos();
    await repos.auth.login('super_root', '1234');
    await repos.super.setPricing({
      commissionRateBp: 1500,
      deliveryBaseSatang: 2000,
      deliveryPerKmSatang: 900,
      serviceFeeSatang: 700,
    });

    const { pricing } = await repos.config.get();
    await repos.auth.login('somchai', '1234');

    const shop = (await repos.catalog.listRestaurants()).find((r) => r.id === 'r-somtam')!;
    const order = await repos.orders.create({
      restaurantId: 'r-somtam',
      items: [{ menuItemId: 'm-somtam-1', quantity: 1, choiceIds: ['c-st1-2'] }],
      paymentMethod: 'promptpay',
    });

    const preview = orderTotals(order.foodTotal, shop.distanceKm, pricing);
    expect(preview.deliveryFee).toBe(order.deliveryFee);
    expect(preview.serviceFee).toBe(order.serviceFee);
    expect(preview.grandTotal).toBe(order.foodTotal + order.deliveryFee + order.serviceFee);
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
