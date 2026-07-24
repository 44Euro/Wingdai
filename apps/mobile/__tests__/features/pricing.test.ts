import { orderTotals, DELIVERY_FEE, SERVICE_FEE } from '../../src/features/cart/pricing';

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
