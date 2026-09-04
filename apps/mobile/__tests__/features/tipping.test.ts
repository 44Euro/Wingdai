import { createMockRepos } from '../../src/data/mock';

/** ทิปให้ไรเดอร์ (design C11) */
type Repos = ReturnType<typeof createMockRepos>;

/**
 * §6.2 ทิปเก็บผ่านเกตเวย์ ประตูจึงปิดอยู่จนกว่า §11.3 จะได้คำตอบ เทสต์ชุดนี้สนใจกติกาบัญชี
 * ของทิป ไม่ได้สนใจตัวประตู จึงเปิดให้เหมือนที่ซูเปอร์แอดมินจะทำในวันที่เกตเวย์พร้อม
 */
async function openTipping(repos: Repos) {
  await repos.auth.login('super_root', '1234');
  await repos.super.setFlag('card_payment', true);
}

async function deliveredOrder(repos: Repos) {
  await openTipping(repos);
  await repos.auth.login('somchai', '1234');
  const order = await repos.orders.create({
    restaurantId: 'r-malee',
    items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
    paymentMethod: 'promptpay',
  });
  await repos.orders.updateStatus(order.id, 'accepted');

  await repos.auth.login('rider_ann', '1234');
  await repos.rider.acceptOffer(order.id);
  await repos.orders.updateStatus(order.id, 'preparing');
  await repos.orders.updateStatus(order.id, 'picked_up');
  await repos.orders.updateStatus(order.id, 'delivered', {
    deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg',
  });

  await repos.auth.login('somchai', '1234');
  return order;
}

describe('ให้ทิปได้เมื่อไหร่', () => {
  it('ออร์เดอร์ใหม่ยังไม่มีทิป', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    expect(order.tipSatang).toBe(0);
  });

  it('ส่งถึงแล้วให้ทิปได้ และยอดถูกบันทึกบนออร์เดอร์', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    const tipped = await repos.orders.tip(order.id, 2_000);
    expect(tipped.tipSatang).toBe(2_000);
  });

  it('ยังไม่ส่งถึง ให้ทิปไม่ได้', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    await expect(repos.orders.tip(order.id, 2_000)).rejects.toThrow();
  });

  it('คนอื่นให้ทิปแทนไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.auth.login('malee', '1234');
    await expect(repos.orders.tip(order.id, 2_000)).rejects.toThrow();
  });

  it('ให้ซ้ำใบเดิมไม่ได้ — ledger ของทิปเขียนไปแล้วและย้อนไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.orders.tip(order.id, 2_000);
    await expect(repos.orders.tip(order.id, 1_000)).rejects.toThrow();
  });

  it('ยอดศูนย์ ติดลบ หรือเกินเพดาน ไม่ผ่าน', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await expect(repos.orders.tip(order.id, 0)).rejects.toThrow();
    await expect(repos.orders.tip(order.id, -100)).rejects.toThrow();
    await expect(repos.orders.tip(order.id, 50_001)).rejects.toThrow();
  });
});

describe('เงินทิปไปถึงไรเดอร์', () => {
  it('เข้าไรเดอร์เต็มจำนวน ไม่หักคอมสักสตางค์', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);

    await repos.auth.login('rider_ann', '1234');
    const before = await repos.rider.balance();

    await repos.auth.login('somchai', '1234');
    await repos.orders.tip(order.id, 4_000);

    await repos.auth.login('rider_ann', '1234');
    const after = await repos.rider.balance();

    expect(after.payableSatang - before.payableSatang).toBe(4_000);
  });

  it('ทิปทำให้ยอดถอนได้เพิ่มขึ้นเท่ากันเป๊ะ', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);

    await repos.auth.login('rider_ann', '1234');
    const before = await repos.rider.balance();

    await repos.auth.login('somchai', '1234');
    await repos.orders.tip(order.id, 1_000);

    await repos.auth.login('rider_ann', '1234');
    const after = await repos.rider.balance();

    expect(after.withdrawableSatang - before.withdrawableSatang).toBe(1_000);
    // ยอดยังเป็นจำนวนเต็มสตางค์เสมอ (§5 กฎข้อ 1)
    expect(Number.isInteger(after.payableSatang)).toBe(true);
  });

  /** ทิปไม่ใช่ยอดขายของร้าน ร้านต้องไม่ได้อะไรจากมันเลย */
  it('ทิปไม่ไปโผล่ในยอดขายของร้าน', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);

    await repos.auth.login('malee', '1234');
    const before = await repos.merchant.summary();

    await repos.auth.login('somchai', '1234');
    await repos.orders.tip(order.id, 4_000);

    await repos.auth.login('malee', '1234');
    const after = await repos.merchant.summary();

    expect(after.today.netSatang).toBe(before.today.netSatang);
    expect(after.today.foodSalesSatang).toBe(before.today.foodSalesSatang);
  });
});

describe('ประตูเกตเวย์ของทิป (product-spec §6.2)', () => {
  /** ปุ่มทิปที่เครดิตไรเดอร์โดยไม่เก็บเงินลูกค้าคือหนี้ที่สร้างจากอากาศ */
  it('ยังไม่มีเกตเวย์ ให้ทิปไม่ได้ แม้ออร์เดอร์จะครบเงื่อนไขอื่นทุกข้อ', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);

    await repos.auth.login('super_root', '1234');
    await repos.super.setFlag('card_payment', false);
    await repos.auth.login('somchai', '1234');

    await expect(repos.orders.tip(order.id, 5000)).rejects.toThrow();
    expect((await repos.orders.get(order.id))?.tipSatang).toBe(0);
  });
});
