import { createMockRepos } from '../../src/data/mock';

type Repos = ReturnType<typeof createMockRepos>;

/** เดินจนไรเดอร์รับของแล้วกำลังเดินทางไปส่ง */
async function jobInTransit(repos: Repos) {
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
  return order;
}

/** แจ้งปัญหาระหว่างส่ง (design R9) */
describe('ไรเดอร์แจ้งปัญหา (R9)', () => {
  it('แจ้งแล้วเรื่องเข้าคิวแอดมิน', async () => {
    const repos = createMockRepos();
    const order = await jobInTransit(repos);
    await repos.rider.reportIssue({ orderId: order.id, kind: 'cannot_reach_customer' });

    await repos.auth.login('admin_root', '1234');
    const exceptions = await repos.admin.exceptions();
    const mine = exceptions.find((e) => e.orderId === order.id);
    expect(mine?.kind).toBe('rider_issue');
    expect(mine?.riderIssueId).toBeTruthy();
  });

  it('แจ้งปัญหาไม่เปลี่ยนสถานะออร์เดอร์เอง — แอดมินเป็นคนตัดสิน', async () => {
    const repos = createMockRepos();
    const order = await jobInTransit(repos);
    await repos.rider.reportIssue({ orderId: order.id, kind: 'accident' });

    await repos.auth.login('somchai', '1234');
    expect((await repos.orders.get(order.id))?.status).toBe('picked_up');
  });

  /** ข้อความที่แอดมินเห็นต้องบอกว่า "ต้องไปทำอะไร" ไม่ใช่แค่ชื่อปัญหา */
  it('คิวแอดมินบอกวิธีจัดการ และแนบสิ่งที่ไรเดอร์พิมพ์มาด้วย', async () => {
    const repos = createMockRepos();
    const order = await jobInTransit(repos);
    await repos.rider.reportIssue({
      orderId: order.id,
      kind: 'bad_address',
      detail: 'ซอยนี้ไม่มีบ้านเลขที่ 42',
    });

    await repos.auth.login('admin_root', '1234');
    const mine = (await repos.admin.exceptions()).find((e) => e.orderId === order.id)!;
    expect(mine.detail).toContain('โทรถามลูกค้า');
    expect(mine.detail).toContain('ซอยนี้ไม่มีบ้านเลขที่ 42');
  });

  it('แจ้งงานของคนอื่นไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await jobInTransit(repos);

    await repos.auth.login('rider_new', '1234');
    await expect(
      repos.rider.reportIssue({ orderId: order.id, kind: 'accident' }),
    ).rejects.toThrow();
  });

  /** ใบที่ส่งถึงแล้วไม่มีอะไรให้ช่วย ปัญหาหลังส่งเป็นเรื่องของระบบคืนเงิน (§6.4) */
  it('งานที่ส่งถึงแล้วแจ้งผ่านช่องนี้ไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await jobInTransit(repos);
    await repos.orders.updateStatus(order.id, 'delivered', { deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg' });

    await expect(
      repos.rider.reportIssue({ orderId: order.id, kind: 'cannot_reach_customer' }),
    ).rejects.toThrow();
  });

  /** §3 ข้อ 6 งานปฏิบัติการต้องจบได้จากมือถือ แอดมินจึงต้องเคลียร์เรื่องได้ด้วยปุ่มเดียว */
  it('แอดมินเคลียร์เรื่องแล้วหลุดจากคิว แต่ออร์เดอร์ไม่ขยับ', async () => {
    const repos = createMockRepos();
    const order = await jobInTransit(repos);
    await repos.rider.reportIssue({ orderId: order.id, kind: 'cannot_reach_customer' });

    await repos.auth.login('admin_root', '1234');
    const issueId = (await repos.admin.exceptions())
      .find((e) => e.orderId === order.id)!.riderIssueId!;
    await repos.admin.resolveRiderIssue(issueId);

    expect((await repos.admin.exceptions()).some((e) => e.kind === 'rider_issue')).toBe(false);
    await repos.auth.login('somchai', '1234');
    expect((await repos.orders.get(order.id))?.status).toBe('picked_up');
  });

  it('เคลียร์ซ้ำไม่ได้', async () => {
    const repos = createMockRepos();
    const order = await jobInTransit(repos);
    await repos.rider.reportIssue({ orderId: order.id, kind: 'accident' });

    await repos.auth.login('admin_root', '1234');
    const issueId = (await repos.admin.exceptions())
      .find((e) => e.orderId === order.id)!.riderIssueId!;
    await repos.admin.resolveRiderIssue(issueId);
    await expect(repos.admin.resolveRiderIssue(issueId)).rejects.toThrow();
  });
});
