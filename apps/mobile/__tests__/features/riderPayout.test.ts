import { createMockRepos } from '../../src/data/mock';

/** ถอนเงินไรเดอร์ (design R12 product-spec §6.2) */
type Repos = ReturnType<typeof createMockRepos>;

async function deliverOrder(repos: Repos, paymentMethod: 'cash' | 'promptpay') {
  await repos.auth.login('somchai', '1234');
  const order = await repos.orders.create({
    restaurantId: 'r-malee',
    items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
    paymentMethod,
  });
  await repos.orders.updateStatus(order.id, 'accepted');

  await repos.auth.login('rider_ann', '1234');
  await repos.rider.acceptOffer(order.id);
  await repos.orders.updateStatus(order.id, 'preparing');
  await repos.orders.updateStatus(order.id, 'picked_up');
  await repos.orders.updateStatus(order.id, 'delivered', { deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg' });
  return order;
}

describe('ยอดเงินของไรเดอร์', () => {
  it('ยอดถอนได้เท่ากับรายได้ลบเงินสดที่ถืออยู่เสมอ', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'cash');

    const b = await repos.rider.balance();
    expect(b.withdrawableSatang).toBe(b.payableSatang - b.cashHeldSatang);
  });

  it('ส่งงานเงินสดแล้วยอดถอนติดลบ เพราะเงินในมือมากกว่าค่าส่ง', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'cash');

    const b = await repos.rider.balance();
    expect(b.cashHeldSatang).toBeGreaterThan(b.payableSatang);
    // ติดลบต้องติดลบจริง ไม่ใช่ถูกปัดเป็นศูนย์จนยอดที่ค้างหายไปเงียบ ๆ
    expect(b.withdrawableSatang).toBeLessThan(0);
  });

  it('ส่งงานพร้อมเพย์ ไม่ถือเงินสด จึงถอนได้ทันที', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'promptpay');

    const b = await repos.rider.balance();
    expect(b.cashHeldSatang).toBe(0);
    expect(b.withdrawableSatang).toBeGreaterThan(0);
  });
});

describe('ขอถอนเงิน', () => {
  it('ถอนเกินยอดสุทธิไม่สำเร็จ แม้รายได้ค้างจ่ายจะพอ', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'promptpay');
    await deliverOrder(repos, 'cash');

    const b = await repos.rider.balance();
    expect(b.payableSatang).toBeGreaterThan(b.withdrawableSatang);

    await expect(repos.rider.requestPayout(b.payableSatang)).rejects.toThrow();
  });

  it('ถอนได้พอดียอดสุทธิ', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'promptpay');

    const b = await repos.rider.balance();
    const payout = await repos.rider.requestPayout(b.withdrawableSatang);
    expect(payout.status).toBe('requested');
    expect(payout.amountSatang).toBe(b.withdrawableSatang);
  });

  it('คำขอเริ่มที่รอตัดสิน เงินยังไม่ออก ยอดจึงยังไม่ลด', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'promptpay');

    const before = await repos.rider.balance();
    await repos.rider.requestPayout(before.withdrawableSatang);

    // §6.4 คำขอไม่ใช่การจ่าย เงินออกต่อเมื่อแอดมินกดยืนยัน
    const after = await repos.rider.balance();
    expect(after.payableSatang).toBe(before.payableSatang);
    expect(after.pending?.status).toBe('requested');
  });

  it('มีคำขอค้างอยู่แล้ว ขอซ้ำไม่ได้', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'promptpay');

    const b = await repos.rider.balance();
    await repos.rider.requestPayout(b.withdrawableSatang);
    await expect(repos.rider.requestPayout(1)).rejects.toThrow();
  });

  it('ยอดศูนย์หรือติดลบถอนไม่ได้', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'promptpay');

    await expect(repos.rider.requestPayout(0)).rejects.toThrow();
    await expect(repos.rider.requestPayout(-100)).rejects.toThrow();
  });

  it('ยอดสุทธิติดลบ ขอถอนบาทเดียวก็ไม่ได้', async () => {
    const repos = createMockRepos();
    await deliverOrder(repos, 'cash');

    const b = await repos.rider.balance();
    expect(b.withdrawableSatang).toBeLessThan(0);
    await expect(repos.rider.requestPayout(1)).rejects.toThrow();
  });
});
