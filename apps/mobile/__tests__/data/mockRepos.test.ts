import { createMockRepos, MOCK_VERIFICATION_TOKEN } from '../../src/data/mock';
import { MOCK_PASSWORD } from '../../src/data/mock/seed';
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

  it('ล็อกอินด้วยเบอร์โทรแทน username ได้', async () => {
    const repos = createMockRepos();
    const acc = await repos.auth.login('0812345678', '1234');
    expect(acc.username).toBe('somchai');
  });

  // อีเมลเป็นแค่ช่องทางรีเซ็ตรหัส ไม่ใช่ identifier (claude.md §4.2 ปรับ 2026-07-29)
  it('ล็อกอินด้วยอีเมลไม่ได้', async () => {
    const repos = createMockRepos();
    await expect(repos.auth.login('somchai@wingdai.test', '1234')).rejects.toThrow();
  });

  it('ล็อกอินด้วย username เดิมยังใช้ได้ (regression)', async () => {
    const repos = createMockRepos();
    const acc = await repos.auth.login('somchai', '1234');
    expect(acc.username).toBe('somchai');
  });

  it('identifier มั่วต้อง reject', async () => {
    const repos = createMockRepos();
    await expect(repos.auth.login('not_a_real_identifier', '1234')).rejects.toThrow();
  });

  it('register พร้อมอีเมล — อีเมลถูกเก็บไว้ แต่ล็อกอินด้วยเบอร์ที่สมัคร ไม่ใช่ด้วยอีเมล', async () => {
    const repos = createMockRepos();
    const created = await repos.auth.register({
      username: 'newuser1',
      password: '1234',
      fullName: 'ผู้ใช้ใหม่',
      phone: '0899999999',
      accountType: 'user',
      email: 'newuser1@example.com',
      verificationToken: MOCK_VERIFICATION_TOKEN,
    });
    expect(created.email).toBe('newuser1@example.com');

    const acc = await repos.auth.login('0899999999', '1234');
    expect(acc.username).toBe('newuser1');

    await expect(repos.auth.login('newuser1@example.com', '1234')).rejects.toThrow();
  });

  it('register ไม่ใส่อีเมล แล้วล็อกอินด้วย username ได้', async () => {
    const repos = createMockRepos();
    await repos.auth.register({
      username: 'newuser2',
      password: '1234',
      fullName: 'ผู้ใช้ใหม่สอง',
      phone: '0888888888',
      accountType: 'user',
      verificationToken: MOCK_VERIFICATION_TOKEN,
    });
    const acc = await repos.auth.login('newuser2', '1234');
    expect(acc.username).toBe('newuser2');
  });
});

describe('MockRepo — orders', () => {
  /** ต้องล็อกอินก่อนสั่งทุกครั้ง เหมือนของจริงที่เซิร์ฟเวอร์รู้ตัวคนสั่งจาก token ไม่ใช่จาก body */
  async function signedIn() {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    return repos;
  }

  it('สร้างออร์เดอร์แล้วคำนวณ foodTotal จากรายการ', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });
    // ชาไทยเย็น ฿25 — ราคามาจากเมนู ไม่ใช่จากที่ผู้เรียกส่งมา
    expect(order.foodTotal).toBe(2500);
    expect(order.deliveryFee).toBe(1500);
    expect(order.serviceFee).toBe(500);
    expect(order.status).toBe('created');
  });

  it('เปลี่ยนสถานะตามลำดับได้', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });
    const accepted = await repos.orders.updateStatus(order.id, 'accepted');
    expect(accepted.status).toBe('accepted');
  });

  it('ข้ามขั้นตอนต้องโยน InvalidTransitionError', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });
    await expect(repos.orders.updateStatus(order.id, 'delivered')).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it('แต่ละ instance แยก state จากกัน', async () => {
    const a = await signedIn();
    const b = createMockRepos();
    await a.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
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

describe('catalog.getMenu + orders guard', () => {
  /**
   * เดิมกรองของหมดออกไปเลย — เปลี่ยนเป็นคืนมาด้วยแล้วให้จอขึ้นป้าย "วันนี้หมดแล้ว"
   * เพราะลูกค้าควรรู้ว่าร้านมีจานนี้ขาย แค่วันนี้ไม่มี ไม่ใช่คิดว่าร้านไม่เคยขาย
   * ฝั่งเซิร์ฟเวอร์ก็คืนมาทั้งหมดเหมือนกัน — สองฝั่งต้องตรงกัน
   */
  it('getMenu คืนเมนูของร้านนั้นทั้งหมด รวมของที่หมดแล้ว', async () => {
    const repos = createMockRepos();
    const menu = await repos.catalog.getMenu('r-malee');
    expect(menu.every((m) => m.restaurantId === 'r-malee')).toBe(true);
    const soldOut = menu.find((m) => m.id === 'm-malee-5');
    expect(soldOut).toBeTruthy();
    expect(soldOut?.isAvailable).toBe(false);
  });

  it('createOrder ของลูกค้าที่ไม่ใช่เจ้าของร้าน → สำเร็จ สถานะ created', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 2, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });
    expect(order.status).toBe('created');
    // ชาไทยเย็น ฿25 × 2 = ฿50 — ราคามาจากเมนูในข้อมูลตั้งต้น
    expect(order.foodTotal).toBe(5000);
  });

  it('เจ้าของร้านสั่งร้านตัวเอง → ถูกบล็อกที่ชั้น repo (throw)', async () => {
    const repos = createMockRepos();
    // มาลีเป็นเจ้าของครัวมาลี — ล็อกอินเป็นมาลีแล้วสั่งครัวมาลีต้องไม่ได้ (claude.md §4.3)
    await repos.auth.login('malee', MOCK_PASSWORD);
    await expect(repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    })).rejects.toThrow();
  });

  it('ยังไม่ล็อกอิน สั่งไม่ได้ — เซิร์ฟเวอร์รู้ว่าใครสั่งจาก token ไม่ใช่จากที่แอปบอก', async () => {
    const repos = createMockRepos();
    await expect(repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'cash',
    })).rejects.toThrow();
  });

  it('ราคามาจากเมนู ไม่ใช่จากที่จอส่งมา', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    // ชาไทยเย็น ฿25 ในข้อมูลตั้งต้น — สั่ง 2 แก้วต้องได้ ฿50 เสมอ ไม่ว่าจอจะคิดว่าเท่าไหร่
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 2, choiceIds: [] }],
      paymentMethod: 'cash',
    });
    expect(order.foodTotal).toBe(5000);
    expect(order.items[0]!.unitPrice).toBe(2500);
  });

  it('ตัวเลือกที่เลือกถูกบวกเข้าราคาต่อหน่วยและต่อท้ายชื่อ', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    // ข้าวกะเพรา ฿50 + ไข่ดาว ฿15 = ฿65 · กลุ่ม "ระดับเผ็ด" บังคับเลือกหนึ่งอย่าง
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid', 'c-egg'] }],
      paymentMethod: 'cash',
    });
    expect(order.items[0]!.unitPrice).toBe(6500);
    expect(order.items[0]!.name).toContain('ไข่ดาว');
  });

  it('ไม่เลือกกลุ่มที่ร้านบังคับ สั่งไม่ได้', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    await expect(repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: [] }],
      paymentMethod: 'cash',
    })).rejects.toThrow();
  });

  it('เมนูที่หมดแล้วสั่งไม่ได้', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    await expect(repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-5', quantity: 1, choiceIds: [] }],
      paymentMethod: 'cash',
    })).rejects.toThrow();
  });

  it('เมนูของร้านอื่นเอามาผสมไม่ได้', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    await expect(repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-somtam-3', quantity: 1, choiceIds: [] }],
      paymentMethod: 'cash',
    })).rejects.toThrow();
  });

  it('สั่งเงินสด → ยังไม่ถือว่าจ่าย', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'cash',
    });
    expect(order.paymentStatus).toBe('pending');
  });
});

/**
 * ลูกค้าสั่งเงินสดแล้วเงินไม่พอ — กติกาต้องอยู่ที่ชั้น repo ด้วย ไม่ใช่แค่จอซ่อนปุ่มไว้
 * (ของจริงคือเซิร์ฟเวอร์เป็นคนตัดสิน จอเป็นแค่ความสะดวก)
 */
describe('orders.payWithPromptPay', () => {
  const cashInput = {
    restaurantId: 'r-malee',
    items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
    paymentMethod: 'cash' as const,
  };

  /** ต้องล็อกอินก่อนทุกครั้ง เหมือนของจริงที่เซิร์ฟเวอร์รู้ตัวคนสั่งจาก token */
  async function signedIn() {
    const repos = createMockRepos();
    await repos.auth.login('somchai', MOCK_PASSWORD);
    return repos;
  }

  it('เปลี่ยนออร์เดอร์เงินสดที่ค้างอยู่เป็นพร้อมเพย์แล้วถือว่าจ่ายแล้ว', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create(cashInput);
    const paid = await repos.orders.payWithPromptPay(order.id);
    expect(paid.paymentMethod).toBe('promptpay');
    expect(paid.paymentStatus).toBe('paid');
  });

  it('การเปลี่ยนถูกบันทึกจริง อ่านซ้ำแล้วยังเป็นพร้อมเพย์', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create(cashInput);
    await repos.orders.payWithPromptPay(order.id);
    expect((await repos.orders.get(order.id))?.paymentStatus).toBe('paid');
  });

  it('กดจ่ายซ้ำรอบสองถูกปฏิเสธ', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create(cashInput);
    await repos.orders.payWithPromptPay(order.id);
    await expect(repos.orders.payWithPromptPay(order.id)).rejects.toThrow();
  });

  it('ส่งถึงแล้วเปลี่ยนไม่ได้ — ถือว่าเก็บเงินสดไปแล้ว', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create(cashInput);
    for (const s of ['accepted', 'preparing', 'picked_up', 'delivered'] as const) {
      // eslint-disable-next-line no-await-in-loop
      await repos.orders.updateStatus(order.id, s);
    }
    await expect(repos.orders.payWithPromptPay(order.id)).rejects.toThrow();
  });

  it('ออร์เดอร์ที่จ่ายพร้อมเพย์อยู่แล้วกดซ้ำไม่ได้', async () => {
    const repos = await signedIn();
    const order = await repos.orders.create({ ...cashInput, paymentMethod: 'promptpay' });
    await expect(repos.orders.payWithPromptPay(order.id)).rejects.toThrow();
  });
});

describe('catalog.createMenuItem', () => {
  it('เพิ่มเมนูใหม่แล้ว getMenu เห็น พร้อม optionGroups', async () => {
    const repos = createMockRepos();
    const created = await repos.catalog.createMenuItem({
      restaurantId: 'r-malee', name: 'ผัดซีอิ๊ว', price: 5500, category: 'noodle', isAvailable: true,
      optionGroups: [{ id: 'g1', name: 'ไข่', minSelect: 0, maxSelect: 1, choices: [{ id: 'c1', name: 'ไข่ดาว', priceDelta: 1000 }] }],
    });
    expect(created.id).toBeTruthy();
    const menu = await repos.catalog.getMenu('r-malee');
    const found = menu.find((m) => m.id === created.id);
    expect(found).toBeTruthy();
    expect(found?.optionGroups?.[0].choices[0].name).toBe('ไข่ดาว');
  });
});
