import { planReorder } from '../../src/features/customer/reorder';
import type { MenuItem, Order } from '../../src/data/types';

const spicy = {
  id: 'g-spicy',
  name: 'ระดับความเผ็ด',
  minSelect: 1,
  maxSelect: 1,
  choices: [
    { id: 'c-mild', name: 'เผ็ดน้อย', priceDelta: 0 },
    { id: 'c-mid', name: 'เผ็ดกลาง', priceDelta: 0 },
  ],
};

const kaphrao: MenuItem = {
  id: 'm-1', restaurantId: 'r-1', name: 'ข้าวกะเพรา', price: 5000,
  category: 'rice', isAvailable: true, optionGroups: [spicy],
};
const somtam: MenuItem = {
  id: 'm-2', restaurantId: 'r-1', name: 'ส้มตำ', price: 4000,
  category: 'somtam', isAvailable: true,
};

function orderOf(items: Order['items']): Order {
  return {
    id: 'o-1', reference: 'WD-1', customerId: 'u-1', restaurantId: 'r-1',
    status: 'delivered', items,
    foodTotal: 9000, deliveryFee: 1500, serviceFee: 500,
    paymentMethod: 'promptpay', paymentStatus: 'paid',
    createdAt: '2026-08-01T10:00:00Z',
    restaurantLat: null, restaurantLng: null, dropoffLat: null, dropoffLng: null,
    riderLocation: null, tipSatang: 0, leaveAtDoor: false,
    cancelledBy: null, cancelReason: null,
  };
}

const line = (over: Partial<Order['items'][number]>): Order['items'][number] => ({
  menuItemId: 'm-1', name: 'ข้าวกะเพรา (เผ็ดกลาง)', choiceNames: ['เผ็ดกลาง'],
  choiceIds: ['c-mid'], unitPrice: 5000, quantity: 2, ...over,
});

describe('planReorder (C33)', () => {
  it('ประกอบตะกร้าเดิมได้ครบพร้อมตัวเลือกและจำนวน', () => {
    const plan = planReorder(orderOf([line({})]), [kaphrao, somtam]);
    expect(plan.unavailable).toEqual([]);
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]!.quantity).toBe(2);
    expect(plan.lines[0]!.selectedChoices.map((c) => c.choiceId)).toEqual(['c-mid']);
    // groupId ต้องติดมาด้วย ไม่งั้นตะกร้าแยกไม่ออกว่าตัวเลือกนี้อยู่กลุ่มไหน
    expect(plan.lines[0]!.selectedChoices[0]!.groupId).toBe('g-spicy');
  });

  it('ใช้ราคาเมนูวันนี้ ไม่ใช่ราคาที่แช่แข็งไว้ในใบเก่า', () => {
    const pricier = { ...kaphrao, price: 6000 };
    const plan = planReorder(orderOf([line({ unitPrice: 5000 })]), [pricier]);
    // ถ้าใช้ราคาเก่า จอตะกร้าจะโชว์เลขหนึ่งแล้วเซิร์ฟเวอร์คิดอีกเลข
    expect(plan.lines[0]!.menuItem.price).toBe(6000);
  });

  it('จานที่ร้านกดของหมดวันนี้ ใส่ไม่ได้และต้องบอกชื่อ', () => {
    const soldOut = { ...kaphrao, isAvailable: false };
    const plan = planReorder(orderOf([line({})]), [soldOut]);
    expect(plan.lines).toEqual([]);
    expect(plan.unavailable).toEqual(['ข้าวกะเพรา (เผ็ดกลาง)']);
  });

  it('จานที่ร้านลบทิ้งไปแล้ว ก็บอกเหมือนกัน ไม่ใช่หายเงียบ ๆ', () => {
    const plan = planReorder(orderOf([line({})]), [somtam]);
    expect(plan.lines).toEqual([]);
    expect(plan.unavailable).toHaveLength(1);
  });

  it('ตัวเลือกที่บังคับเลือกแต่หายไปแล้ว = ใส่ไม่ได้ ไม่ใช่ใส่ไปให้เซิร์ฟเวอร์เด้ง', () => {
    const changed = {
      ...kaphrao,
      optionGroups: [{ ...spicy, choices: [{ id: 'c-hot', name: 'เผ็ดมาก', priceDelta: 0 }] }],
    };
    const plan = planReorder(orderOf([line({})]), [changed]);
    expect(plan.lines).toEqual([]);
    expect(plan.unavailable).toHaveLength(1);
  });

  it('ใส่ได้บางจาน ก็ใส่เท่าที่ได้ แล้วบอกว่าอะไรตกไป', () => {
    const soldOut = { ...somtam, isAvailable: false };
    const plan = planReorder(
      orderOf([line({}), line({ menuItemId: 'm-2', name: 'ส้มตำ', choiceIds: [], choiceNames: [] })]),
      [kaphrao, soldOut],
    );
    expect(plan.lines).toHaveLength(1);
    expect(plan.unavailable).toEqual(['ส้มตำ']);
  });

  it('ข้อความถึงร้านติดไปด้วย', () => {
    const plan = planReorder(orderOf([line({ note: 'ไม่ใส่ผักชี' })]), [kaphrao]);
    expect(plan.lines[0]!.note).toBe('ไม่ใส่ผักชี');
  });
});
