import { createMockRepos } from '../../src/data/mock';

/**
 * เงินสดในมือไรเดอร์ (claude.md §6.2)
 *
 * ก่อนหน้านี้ `cash_held_satang` มีแต่ทางเพิ่ม ไม่มีทางลดเลยทั้งระบบ ไรเดอร์ที่ส่งงาน
 * เงินสดจนชนเพดาน ฿1,500 จะถูก eligibility.ts ตัดจากงานเงินสด **ถาวร**
 * เทสต์ชุดนี้เดินเส้นทางนั้นทั้งเส้นเพื่อกันไม่ให้ขาลดหายไปอีก
 */
const CASH_LIMIT_SATANG = 150000;

/** สั่งเงินสดหนึ่งใบแล้วเดินจนส่งถึง โดยไรเดอร์ ann เป็นคนส่ง */
async function deliverCashOrder(repos: ReturnType<typeof createMockRepos>) {
  await repos.auth.login('somchai', '1234');
  const order = await repos.orders.create({
    restaurantId: 'r-malee',
    items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
    paymentMethod: 'cash',
  });
  await repos.orders.updateStatus(order.id, 'accepted');

  await repos.auth.login('rider_ann', '1234');
  await repos.rider.acceptOffer(order.id);
  await repos.orders.updateStatus(order.id, 'preparing');
  await repos.orders.updateStatus(order.id, 'picked_up');
  await repos.orders.updateStatus(order.id, 'delivered');

  return order.foodTotal + order.deliveryFee + order.serviceFee;
}

describe('เงินสดในมือไรเดอร์', () => {
  it('ส่งงานเงินสดแล้วยอดเงินในมือเพิ่มเท่ากับยอดที่ลูกค้าจ่ายทั้งใบ', async () => {
    const repos = createMockRepos();
    const gross = await deliverCashOrder(repos);

    const status = await repos.rider.status();
    // ไรเดอร์ถือ "ยอดเต็มใบ" ไม่ใช่แค่ค่าส่ง — ค่าอาหารเป็นเงินของบริษัทที่ต้องส่งต่อให้ร้าน
    expect(status.cashHeldSatang).toBe(gross);
  });

  it('สั่งพร้อมเพย์ไม่ทำให้ไรเดอร์ถือเงินสด', async () => {
    const repos = createMockRepos();
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
    await repos.orders.updateStatus(order.id, 'delivered');

    expect((await repos.rider.status()).cashHeldSatang).toBe(0);
  });

  /** ขาที่หายไปทั้งระบบก่อนหน้านี้ — ถ้าไม่มีอันนี้ ยอดจะขึ้นอย่างเดียวจนชนเพดาน */
  it('แอดมินรับเงินนำส่งแล้วยอดในมือลดลง', async () => {
    const repos = createMockRepos();
    const gross = await deliverCashOrder(repos);

    await repos.auth.login('admin_root', '1234');
    const holders = await repos.admin.ridersHoldingCash();
    const ann = holders.find((h) => h.cashHeldSatang === gross);
    expect(ann).toBeDefined();

    const result = await repos.admin.settleRiderCash(ann!.accountId, gross);
    expect(result.cashHeldSatang).toBe(0);

    await repos.auth.login('rider_ann', '1234');
    expect((await repos.rider.status()).cashHeldSatang).toBe(0);
  });

  it('รับนำส่งบางส่วนได้ ยอดที่เหลือยังถูกต้อง', async () => {
    const repos = createMockRepos();
    const gross = await deliverCashOrder(repos);

    await repos.auth.login('admin_root', '1234');
    const holders = await repos.admin.ridersHoldingCash();
    const ann = holders[0]!;

    const result = await repos.admin.settleRiderCash(ann.accountId, 5000);
    expect(result.cashHeldSatang).toBe(gross - 5000);
  });

  /**
   * รับเกินยอดที่ถืออยู่แปลว่ามีบางอย่างผิด (นับเงินผิด หรือมีใบที่ไม่ได้ถูกบันทึก)
   * ต้องหยุดไว้ ไม่ใช่ปล่อยให้ยอดติดลบ
   */
  it('รับเงินเกินยอดที่ถืออยู่ไม่ได้', async () => {
    const repos = createMockRepos();
    const gross = await deliverCashOrder(repos);

    await repos.auth.login('admin_root', '1234');
    const ann = (await repos.admin.ridersHoldingCash())[0]!;
    await expect(repos.admin.settleRiderCash(ann.accountId, gross + 1)).rejects.toThrow();
    await expect(repos.admin.settleRiderCash(ann.accountId, 0)).rejects.toThrow();
    await expect(repos.admin.settleRiderCash(ann.accountId, -100)).rejects.toThrow();
  });

  it('ไม่มีใครถือเงินสด คิวก็ว่าง ไม่ใช่แถวที่มียอดศูนย์', async () => {
    const repos = createMockRepos();
    await repos.auth.login('admin_root', '1234');
    expect(await repos.admin.ridersHoldingCash()).toEqual([]);
  });

  /**
   * เส้นทางที่พังจริงก่อนหน้านี้: ส่งงานเงินสดไปเรื่อย ๆ จนชนเพดาน แล้วไม่มีทางกลับมา
   * ตอนนี้นำเงินมาส่งแล้วต้องหลุดจากสถานะชนเพดาน
   */
  it('ชนเพดานแล้วนำเงินมาส่ง กลับมารับงานเงินสดได้', async () => {
    const repos = createMockRepos();
    let held = 0;
    // ส่งซ้ำจนกว่าจะชนเพดาน ฿1,500
    while (held < CASH_LIMIT_SATANG) {
      // eslint-disable-next-line no-await-in-loop
      held += await deliverCashOrder(repos);
    }

    await repos.auth.login('rider_ann', '1234');
    const before = await repos.rider.status();
    expect(before.cashHeldSatang).toBeGreaterThanOrEqual(before.cashLimitSatang);

    await repos.auth.login('admin_root', '1234');
    const ann = (await repos.admin.ridersHoldingCash())[0]!;
    expect(ann.atLimit).toBe(true);
    await repos.admin.settleRiderCash(ann.accountId, ann.cashHeldSatang);

    await repos.auth.login('rider_ann', '1234');
    const after = await repos.rider.status();
    expect(after.cashHeldSatang).toBe(0);
    expect(after.cashHeldSatang).toBeLessThan(after.cashLimitSatang);
  });
});
