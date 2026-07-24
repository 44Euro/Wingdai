import { orderTotals, orderItemName, DELIVERY_FEE, SERVICE_FEE } from '../../src/features/cart/pricing';

describe('orderTotals', () => {
  it('แยกสามค่าและรวมถูก', () => {
    const t = orderTotals(10000);
    expect(t).toEqual({
      foodTotal: 10000,
      deliveryFee: DELIVERY_FEE,
      serviceFee: SERVICE_FEE,
      grandTotal: 12000,
    });
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
