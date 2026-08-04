import { createMockRepos } from '../../src/data/mock';
import { seedRestaurantCoords, seedAddresses } from '../../src/data/mock/seed';
import { haversineKm } from '../../src/lib/geo';

/** เมนูหนึ่งจานที่สั่งได้จริงของแต่ละร้าน สั่งข้ามร้านจะโดน repo ปฏิเสธ */
const ITEM_OF: Record<string, { menuItemId: string; choiceIds: string[] }> = {
  'r-malee': { menuItemId: 'm-malee-1', choiceIds: ['c-spicy-mid'] },
  'r-somtam': { menuItemId: 'm-somtam-1', choiceIds: ['c-st1-2'] },
};

/** ลูกค้าสั่ง → ร้านรับ → ไรเดอร์รับงานและส่งจนถึงมือ คืนออร์เดอร์ที่ส่งสำเร็จแล้ว */
async function deliverOne(repos: ReturnType<typeof createMockRepos>, restaurantId = 'r-malee') {
  await repos.auth.login('somchai', '1234');
  const order = await repos.orders.create({
    restaurantId,
    items: [{ ...ITEM_OF[restaurantId]!, quantity: 1 }],
    paymentMethod: 'cash',
  });
  await repos.orders.updateStatus(order.id, 'accepted');
  await repos.auth.login('rider_ann', '1234');
  await repos.rider.acceptOffer(order.id);
  await repos.orders.updateStatus(order.id, 'preparing');
  await repos.orders.updateStatus(order.id, 'picked_up');
  await repos.orders.updateStatus(order.id, 'delivered', { deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg' });
  return order;
}

/** ตัวกรองช่วงเวลาและระยะ/เวลาต่อเที่ยวบนจอรายได้ (design R6) */
describe('รายได้ไรเดอร์ — ตัวกรองช่วงเวลา', () => {
  it('ไม่ระบุช่วงได้สัปดาห์เป็นค่าตั้งต้น', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    expect((await repos.rider.earnings()).period).toBe('week');
  });

  it('ช่วงวันนี้ให้ผลย่อยกว่าหรือเท่ากับเดือน', async () => {
    const repos = createMockRepos();
    await deliverOne(repos);

    const today = await repos.rider.earnings('today');
    const month = await repos.rider.earnings('month');

    expect(today.totalPaySatang).toBeLessThanOrEqual(month.totalPaySatang);
    expect(today.deliveries.length).toBeLessThanOrEqual(month.deliveries.length);
    expect(today.period).toBe('today');
  });

  /** งานที่เพิ่งส่งเมื่อกี้ต้องอยู่ในทุกช่วง ไม่ใช่หลุดออกจาก "วันนี้" */
  it('งานที่เพิ่งส่งอยู่ครบทั้งสามช่วง', async () => {
    const repos = createMockRepos();
    const order = await deliverOne(repos);

    for (const period of ['today', 'week', 'month'] as const) {
      // eslint-disable-next-line no-await-in-loop
      const e = await repos.rider.earnings(period);
      expect(e.deliveries.map((d) => d.orderId)).toContain(order.id);
    }
  });

  it('ทุกเที่ยวมีระยะและเวลา ไม่ใช่ค่าว่าง', async () => {
    const repos = createMockRepos();
    await deliverOne(repos);

    const e = await repos.rider.earnings('month');
    expect(e.deliveries.length).toBeGreaterThan(0);
    for (const d of e.deliveries) {
      expect(Number.isFinite(d.distanceKm)).toBe(true);
      expect(Number.isFinite(d.durationMinutes)).toBe(true);
      expect(d.distanceKm).toBeGreaterThan(0);
      expect(d.durationMinutes).toBeGreaterThanOrEqual(0);
    }
  });

  /** ระยะทางต้องมาจากพิกัดจริงของร้านกับปลายทาง ไม่ใช่ค่าคงที่ที่ใส่ไว้ให้จอดูดี */
  it('ระยะทางตรงกับพิกัดร้านและปลายทางจริง', async () => {
    const repos = createMockRepos();
    const order = await deliverOne(repos, 'r-malee');

    const e = await repos.rider.earnings('month');
    const row = e.deliveries.find((d) => d.orderId === order.id)!;

    const shop = seedRestaurantCoords['r-malee']!;
    const drop = seedAddresses.find((a) => a.accountId === 'u-somchai')!;
    expect(row.distanceKm).toBeCloseTo(
      Number(haversineKm(shop, { lat: drop.lat, lng: drop.lng }).toFixed(1)),
      5,
    );
  });

  it('ระยะรวมของช่วงเท่ากับผลบวกของทุกเที่ยว', async () => {
    const repos = createMockRepos();
    await deliverOne(repos, 'r-malee');
    await deliverOne(repos, 'r-somtam');

    const e = await repos.rider.earnings('month');
    expect(e.deliveries.length).toBe(2);
    expect(e.distanceKm).toBeCloseTo(
      e.deliveries.reduce((s, d) => s + d.distanceKm, 0),
      5,
    );
  });

  /** ประวัติเป็นของแต่ละคน ไรเดอร์อีกคนต้องไม่เห็นงานของ ann */
  it('ไม่ปนงานของไรเดอร์คนอื่น', async () => {
    const repos = createMockRepos();
    await deliverOne(repos);

    await repos.auth.login('rider_new', '1234');
    const e = await repos.rider.earnings('month');
    expect(e.deliveries).toEqual([]);
    expect(e.totalPaySatang).toBe(0);
    expect(e.distanceKm).toBe(0);
  });
});
