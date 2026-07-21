import { createMockRepos } from '../../src/data/mock';
import { InvalidTransitionError } from '../../src/data/orderStateMachine';

describe('MockRepo — auth', () => {
  it('ล็อกอินด้วยรหัสถูกต้องได้บัญชีกลับมา', async () => {
    const repos = createMockRepos();
    const acc = await repos.auth.login('somchai', '1234');
    expect(acc.username).toBe('somchai');
    expect(acc.accountType).toBe('user');
  });

  it('รหัสผิดต้อง reject', async () => {
    const repos = createMockRepos();
    await expect(repos.auth.login('somchai', 'wrong')).rejects.toThrow();
  });

  it('ไรเดอร์ที่รออนุมัติล็อกอินได้แต่สถานะเป็น pending', async () => {
    const repos = createMockRepos();
    const acc = await repos.auth.login('rider_new', '1234');
    expect(acc.riderApproval).toBe('pending');
  });
});

describe('MockRepo — orders', () => {
  it('สร้างออร์เดอร์แล้วคำนวณ foodTotal จากรายการ', async () => {
    const repos = createMockRepos();
    const order = await repos.orders.create({
      customerId: 'u-somchai',
      restaurantId: 'r-malee',
      items: [
        { menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 2 },
        { menuItemId: 'm2', name: 'น้ำส้ม', unitPrice: 2500, quantity: 1 },
      ],
      deliveryFee: 1500,
      serviceFee: 500,
    });
    expect(order.foodTotal).toBe(12500);
    expect(order.deliveryFee).toBe(1500);
    expect(order.serviceFee).toBe(500);
    expect(order.status).toBe('created');
  });

  it('เปลี่ยนสถานะตามลำดับได้', async () => {
    const repos = createMockRepos();
    const order = await repos.orders.create({
      customerId: 'u-somchai', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500, serviceFee: 500,
    });
    const accepted = await repos.orders.updateStatus(order.id, 'accepted');
    expect(accepted.status).toBe('accepted');
  });

  it('ข้ามขั้นตอนต้องโยน InvalidTransitionError', async () => {
    const repos = createMockRepos();
    const order = await repos.orders.create({
      customerId: 'u-somchai', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500, serviceFee: 500,
    });
    await expect(repos.orders.updateStatus(order.id, 'delivered')).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it('แต่ละ instance แยก state จากกัน', async () => {
    const a = createMockRepos();
    const b = createMockRepos();
    await a.orders.create({
      customerId: 'u-somchai', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500, serviceFee: 500,
    });
    expect(await b.orders.listForCustomer('u-somchai')).toHaveLength(0);
  });
});

describe('MockRepo — catalog', () => {
  it('มีร้านที่อนุมัติแล้วอย่างน้อยหนึ่งร้าน', async () => {
    const repos = createMockRepos();
    const list = await repos.catalog.listRestaurants();
    expect(list.filter((r) => r.isApproved).length).toBeGreaterThan(0);
  });
});
