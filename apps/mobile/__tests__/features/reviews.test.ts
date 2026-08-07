import { createMockRepos } from '../../src/data/mock';

/** รีวิว (design C11 C36 M9) */
type Repos = ReturnType<typeof createMockRepos>;

async function deliveredOrder(repos: Repos) {
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

describe('ใครรีวิวได้', () => {
  it('ลูกค้าเจ้าของออร์เดอร์ที่ได้รับของแล้ว รีวิวได้', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    const review = await repos.reviews.write(order.id, { restaurantRating: 5 });
    expect(review.restaurantRating).toBe(5);
    expect(review.orderId).toBe(order.id);
  });

  it('ยังไม่ได้รับอาหาร รีวิวไม่ได้', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    await expect(repos.reviews.write(order.id, { restaurantRating: 5 })).rejects.toThrow();
  });

  /** รีวิวที่เขียนได้โดยไม่ต้องเคยสั่ง = คู่แข่งถล่มดาวหนึ่งได้ฟรี */
  it('คนอื่นรีวิวออร์เดอร์ที่ไม่ใช่ของตัวเองไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.auth.login('malee', '1234');
    await expect(repos.reviews.write(order.id, { restaurantRating: 1 })).rejects.toThrow();
  });

  it('รีวิวซ้ำใบเดิมไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.reviews.write(order.id, { restaurantRating: 4 });
    await expect(repos.reviews.write(order.id, { restaurantRating: 5 })).rejects.toThrow();
  });

  it('ดาวนอกช่วง 1–5 ไม่ผ่าน', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await expect(repos.reviews.write(order.id, { restaurantRating: 0 })).rejects.toThrow();
    await expect(repos.reviews.write(order.id, { restaurantRating: 6 })).rejects.toThrow();
  });
});

describe('คะแนนของร้านมาจากรีวิวจริง', () => {
  it('ร้านที่ยังไม่มีใครรีวิว คะแนนเป็น null ไม่ใช่ 0 (§10)', async () => {
    const repos = createMockRepos();
    const shops = await repos.catalog.listRestaurants();
    expect(shops.every((s) => s.rating === null)).toBe(true);

    const summary = await repos.reviews.forRestaurant('r-malee');
    expect(summary.average).toBeNull();
    expect(summary.count).toBe(0);
  });

  it('รีวิวแล้วคะแนนขึ้นที่การ์ดร้านทันที', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.reviews.write(order.id, { restaurantRating: 5 });

    const shop = await repos.catalog.getRestaurant('r-malee');
    expect(shop?.rating).toBe(5);
    // ต้องขึ้นในรายการและผลค้นหาด้วย ไม่ใช่แค่จอรายละเอียด
    expect((await repos.catalog.listRestaurants()).find((s) => s.id === 'r-malee')?.rating).toBe(5);
    expect((await repos.catalog.searchRestaurants('มาลี'))[0]?.rating).toBe(5);
  });

  it('ร้านอื่นที่ยังไม่มีรีวิวยังเป็น null อยู่', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.reviews.write(order.id, { restaurantRating: 5 });

    const other = await repos.catalog.getRestaurant('r-somtam');
    expect(other?.rating).toBeNull();
  });

  it('สรุปคืนครบห้าระดับเสมอ และผลรวมเท่ากับจำนวนรีวิว', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.reviews.write(order.id, { restaurantRating: 4, comment: 'อร่อย' });

    const summary = await repos.reviews.forRestaurant('r-malee');
    expect(summary.breakdown.map((b) => b.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(summary.breakdown.reduce((sum, b) => sum + b.count, 0)).toBe(summary.count);
    expect(summary.reviews[0]?.comment).toBe('อร่อย');
    // ดีไซน์ C36 โชว์ชื่อจานคู่กับวันที่ ต้องมาจากใบที่สั่งจริง
    expect(summary.reviews[0]?.itemName).toBeTruthy();
  });
});

describe('ฝั่งร้าน (M9)', () => {
  it('เจ้าของร้านอ่านรีวิวของร้านตัวเองได้', async () => {
    const repos = createMockRepos();
    const order = await deliveredOrder(repos);
    await repos.reviews.write(order.id, { restaurantRating: 5 });

    await repos.auth.login('malee', '1234');
    const summary = await repos.reviews.forMyRestaurant('r-malee');
    expect(summary.count).toBe(1);
  });

  /** ตอบเหมือนไม่มีร้านนี้ ไม่ยืนยันว่ามีอยู่จริงให้คนที่ไม่ใช่เจ้าของ */
  it('คนอื่นเปิดรีวิวฝั่งร้านของคนอื่นไม่ได้', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');
    await expect(repos.reviews.forMyRestaurant('r-malee')).rejects.toThrow();
  });
});
