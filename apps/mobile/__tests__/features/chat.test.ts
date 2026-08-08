import { createMockRepos } from '../../src/data/mock';

/** แชทของออร์เดอร์ (design C10 M10) แบบเดียวกับ Grab / LINE MAN */
type Repos = ReturnType<typeof createMockRepos>;

async function orderWithRider(repos: Repos) {
  await repos.auth.login('somchai', '1234');
  const order = await repos.orders.create({
    restaurantId: 'r-malee',
    items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
    paymentMethod: 'promptpay',
  });
  await repos.orders.updateStatus(order.id, 'accepted');
  await repos.auth.login('rider_ann', '1234');
  await repos.rider.acceptOffer(order.id);
  await repos.auth.login('somchai', '1234');
  return order;
}

describe('ใครอ่านช่องไหนได้', () => {
  it('ลูกค้ากับไรเดอร์คุยกันได้ และเห็นข้อความของกันและกัน', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);

    await repos.chat.send(order.id, 'customer_rider', 'อยู่ห้อง 502 นะคะ');
    await repos.auth.login('rider_ann', '1234');
    const asRider = await repos.chat.thread(order.id, 'customer_rider');

    expect(asRider.messages).toHaveLength(1);
    expect(asRider.messages[0]?.body).toBe('อยู่ห้อง 502 นะคะ');
    // ข้อความของอีกฝ่ายต้องไม่ถูกทำเครื่องหมายว่าเป็นของตัวเอง (จอวางซ้าย/ขวาจากค่านี้)
    expect(asRider.messages[0]?.mine).toBe(false);
    expect(asRider.peerName).toBe('สมชาย ใจดี');
  });

  /** ข้อสำคัญที่สุดของไฟล์นี้ */
  it('ร้านอ่านช่องที่ลูกค้าคุยกับไรเดอร์ไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);
    await repos.chat.send(order.id, 'customer_rider', 'รหัสประตู 1234');

    await repos.auth.login('malee', '1234');
    await expect(repos.chat.thread(order.id, 'customer_rider')).rejects.toThrow();
  });

  it('ไรเดอร์อ่านช่องที่ลูกค้าคุยกับร้านไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);
    await repos.chat.send(order.id, 'customer_merchant', 'ขอเผ็ดน้อยค่ะ');

    await repos.auth.login('rider_ann', '1234');
    await expect(repos.chat.thread(order.id, 'customer_merchant')).rejects.toThrow();
  });

  it('คนนอกอ่านไม่ได้เลยสักช่อง', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);

    await repos.auth.login('admin_root', '1234');
    await expect(repos.chat.thread(order.id, 'customer_rider')).rejects.toThrow();
    await expect(repos.chat.thread(order.id, 'customer_merchant')).rejects.toThrow();
  });

  it('ลูกค้ากับร้านคุยกันได้', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);
    await repos.chat.send(order.id, 'customer_merchant', 'ขอเผ็ดน้อยค่ะ');

    await repos.auth.login('malee', '1234');
    const asShop = await repos.chat.thread(order.id, 'customer_merchant');
    expect(asShop.messages[0]?.body).toBe('ขอเผ็ดน้อยค่ะ');
  });

  /** สองช่องเป็นคนละห้องจริง ๆ ไม่ใช่ตัวกรองของห้องเดียว */
  it('ข้อความไม่รั่วข้ามช่อง', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);
    await repos.chat.send(order.id, 'customer_rider', 'ถึงยัง');
    await repos.chat.send(order.id, 'customer_merchant', 'ขอช้อนด้วย');

    const rider = await repos.chat.thread(order.id, 'customer_rider');
    const shop = await repos.chat.thread(order.id, 'customer_merchant');
    expect(rider.messages.map((m) => m.body)).toEqual(['ถึงยัง']);
    expect(shop.messages.map((m) => m.body)).toEqual(['ขอช้อนด้วย']);
  });
});

describe('ส่งข้อความได้ตอนไหน', () => {
  it('ข้อความว่างส่งไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);
    await expect(repos.chat.send(order.id, 'customer_rider', '   ')).rejects.toThrow();
  });

  /** จบงานแล้วเป็นอ่านอย่างเดียว ประวัติยังต้องเปิดดูได้ว่าตกลงอะไรกันไว้ */
  it('ส่งถึงแล้วห้องปิดรับข้อความ แต่ยังอ่านย้อนได้', async () => {
    const repos = createMockRepos();
    const order = await orderWithRider(repos);
    await repos.chat.send(order.id, 'customer_rider', 'กำลังไปครับ');

    await repos.auth.login('rider_ann', '1234');
    await repos.orders.updateStatus(order.id, 'preparing');
    await repos.orders.updateStatus(order.id, 'picked_up');
    await repos.orders.updateStatus(order.id, 'delivered', {
      deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg',
    });

    const thread = await repos.chat.thread(order.id, 'customer_rider');
    expect(thread.closed).toBe(true);
    expect(thread.messages).toHaveLength(1);
    await expect(repos.chat.send(order.id, 'customer_rider', 'ทักต่อ')).rejects.toThrow();
  });

  it('ยังไม่มีไรเดอร์ ช่องคุยกับไรเดอร์ยังไม่เปิดให้ไรเดอร์คนอื่น', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });

    await repos.auth.login('rider_ann', '1234');
    await expect(repos.chat.thread(order.id, 'customer_rider')).rejects.toThrow();
  });
});
