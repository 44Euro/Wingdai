import { createMockRepos } from '../../src/data/mock';

type Repos = ReturnType<typeof createMockRepos>;

/** สั่งอาหารแล้วให้ ann รับงาน คืนงานตามที่ไรเดอร์เห็น */
async function jobFor(
  repos: Repos,
  items: { menuItemId: string; quantity: number; choiceIds: string[]; note?: string }[],
) {
  await repos.auth.login('somchai', '1234');
  const order = await repos.orders.create({
    restaurantId: 'r-malee',
    items,
    paymentMethod: 'promptpay',
  });
  await repos.orders.updateStatus(order.id, 'accepted');

  await repos.auth.login('rider_ann', '1234');
  await repos.rider.acceptOffer(order.id);
  const job = (await repos.rider.jobs()).find((j) => j.orderId === order.id)!;
  return { order, job };
}

/** จุดรับอาหาร (design R10) */
describe('จุดรับอาหาร (R10)', () => {
  it('งานพกข้อความที่ลูกค้าฝากถึงร้านมาด้วย', async () => {
    const repos = createMockRepos();
    const { job } = await jobFor(repos, [{
      menuItemId: 'm-malee-1',
      quantity: 1,
      choiceIds: ['c-spicy-mid'],
      note: 'ไม่ใส่ผักชี ขอช้อนส้อมด้วย',
    }]);

    expect(job.items[0]!.note).toBe('ไม่ใส่ผักชี ขอช้อนส้อมด้วย');
  });

  it('ไม่ได้ฝากข้อความ ได้ null ไม่ใช่สตริงว่างให้จอเผลอโชว์บรรทัดเปล่า', async () => {
    const repos = createMockRepos();
    const { job } = await jobFor(repos, [
      { menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] },
    ]);

    expect(job.items[0]!.note).toBeNull();
  });

  /** ตัวเลือกต้องมาเป็นรายการ ไม่ใช่ก้อนข้อความในชื่อจาน จอเช็กลิสต์ต้องติ๊กทีละอัน */
  it('งานพกตัวเลือกที่ลูกค้าเลือกมาเป็นรายการ', async () => {
    const repos = createMockRepos();
    const { job } = await jobFor(repos, [
      { menuItemId: 'm-malee-1', quantity: 2, choiceIds: ['c-spicy-mid'] },
    ]);

    expect(job.items[0]!.quantity).toBe(2);
    expect(job.items[0]!.choiceNames).toContain('เผ็ดกลาง');
  });

  it('จานที่ไม่มีตัวเลือกได้อาร์เรย์ว่าง ไม่ใช่ undefined', async () => {
    const repos = createMockRepos();
    const { job } = await jobFor(repos, [
      { menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] },
    ]);

    expect(job.items[0]!.choiceNames).toEqual([]);
  });

  /** §6.3 ไรเดอร์ที่ถึงร้านก่อนอาหารเสร็จต้องยืนรอฟรี จอนี้จึงต้องบอกได้ว่าอีกนานไหม */
  it('งานบอกเวลาทำของร้านและเวลาที่ร้านรับออร์เดอร์', async () => {
    const repos = createMockRepos();
    const { job } = await jobFor(repos, [
      { menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] },
    ]);

    // ครัวมาลีตั้งเวลาทำไว้ 12 นาทีใน seed
    expect(job.prepTimeMinutes).toBe(12);
    expect(job.acceptedAt).not.toBeNull();
    expect(Number.isNaN(new Date(job.acceptedAt!).getTime())).toBe(false);
  });

  it('ยืนยันรับของแล้วสถานะเป็นรับของแล้ว', async () => {
    const repos = createMockRepos();
    const { order } = await jobFor(repos, [
      { menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] },
    ]);
    await repos.orders.updateStatus(order.id, 'preparing');
    await repos.orders.updateStatus(order.id, 'picked_up');

    const job = (await repos.rider.jobs()).find((j) => j.orderId === order.id)!;
    expect(job.status).toBe('picked_up');
  });

  /** ครัวยังไม่เริ่มทำ = กดรับของไม่ได้ (orders/stateMachine.ts) */
  it('ครัวยังไม่เริ่มทำ กดรับของไม่ได้', async () => {
    const repos = createMockRepos();
    const { order } = await jobFor(repos, [
      { menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] },
    ]);

    await expect(repos.orders.updateStatus(order.id, 'picked_up')).rejects.toThrow();
  });
});
