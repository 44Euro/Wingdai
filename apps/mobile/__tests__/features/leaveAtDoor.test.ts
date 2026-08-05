import { createMockRepos } from '../../src/data/mock';

/** วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
type Repos = ReturnType<typeof createMockRepos>;

async function placeOrder(repos: Repos, leaveAtDoor: boolean) {
  await repos.auth.login('somchai', '1234');
  const order = await repos.orders.create({
    restaurantId: 'r-malee',
    items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
    paymentMethod: 'promptpay',
    leaveAtDoor,
  });
  await repos.orders.updateStatus(order.id, 'accepted');

  await repos.auth.login('rider_ann', '1234');
  await repos.rider.acceptOffer(order.id);
  await repos.orders.updateStatus(order.id, 'preparing');
  await repos.orders.updateStatus(order.id, 'picked_up');
  return order;
}

describe('ลูกค้าขอวางไว้หน้าประตู', () => {
  it('คำขอถูกบันทึกไว้บนออร์เดอร์ ไม่ใช่หายไประหว่างทาง', async () => {
    const repos = createMockRepos();
    const order = await placeOrder(repos, true);
    expect(order.leaveAtDoor).toBe(true);
  });

  it('ไรเดอร์เห็นคำขอนี้ในงานของตัวเอง', async () => {
    const repos = createMockRepos();
    const order = await placeOrder(repos, true);
    const job = (await repos.rider.jobs()).find((j) => j.orderId === order.id)!;
    // ถ้าไม่ส่งมาถึงงาน จอ R11 จะไม่มีทางรู้ว่าต้องซ่อนช่อง PIN
    expect(job.leaveAtDoor).toBe(true);
  });

  it('ปิดงานด้วยรูปอย่างเดียวได้ ไม่ต้องมี PIN', async () => {
    const repos = createMockRepos();
    const order = await placeOrder(repos, true);
    const done = await repos.orders.updateStatus(order.id, 'delivered', {
      photoPath: 'rider-docs/proof.jpg',
    });
    expect(done.status).toBe('delivered');
  });

  it('ส่ง PIN ผิดมาด้วยก็ไม่พัง — แอปเวอร์ชันเก่ายังส่งมาเสมอ', async () => {
    const repos = createMockRepos();
    const order = await placeOrder(repos, true);
    const done = await repos.orders.updateStatus(order.id, 'delivered', {
      deliveryPin: '0000', photoPath: 'rider-docs/proof.jpg',
    });
    expect(done.status).toBe('delivered');
  });

  it('ไม่มีรูป = ปิดงานไม่ได้ · รูปคือหลักฐานชิ้นเดียวที่เหลือ', async () => {
    const repos = createMockRepos();
    const order = await placeOrder(repos, true);
    await expect(repos.orders.updateStatus(order.id, 'delivered', {})).rejects.toThrow();
  });
});

describe('ส่งมือต่อมือ (ค่าตั้งต้น)', () => {
  it('ไม่ติ๊กอะไรเลย = ไม่ใช่วางหน้าประตู', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    expect(order.leaveAtDoor).toBe(false);
  });

  it('ไม่มี PIN = ปิดงานไม่ได้ แม้จะมีรูป', async () => {
    const repos = createMockRepos();
    const order = await placeOrder(repos, false);
    await expect(repos.orders.updateStatus(order.id, 'delivered', {
      photoPath: 'rider-docs/proof.jpg',
    })).rejects.toThrow();
  });

  it('มีทั้ง PIN และรูปจึงปิดได้', async () => {
    const repos = createMockRepos();
    const order = await placeOrder(repos, false);
    const done = await repos.orders.updateStatus(order.id, 'delivered', {
      deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg',
    });
    expect(done.status).toBe('delivered');
  });
});
