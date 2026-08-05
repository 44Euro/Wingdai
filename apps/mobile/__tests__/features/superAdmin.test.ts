import { createMockRepos } from '../../src/data/mock';

/** ชั้นข้อมูลของซูเปอร์แอดมิน (design SA1–SA6) */
type Repos = ReturnType<typeof createMockRepos>;

const asSuper = async (repos: Repos) => repos.auth.login('super_root', '1234');

describe('ซูเปอร์แอดมิน — ตัวเลข §8 (SA1)', () => {
  it('คืนครบเก้าตัว และตัวที่ยังไม่มีข้อมูลเป็น null ไม่ใช่ 0', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    const m = await repos.super.metrics();

    // เก้าตัวของ §8 ต้องมีคีย์ครบ จอซ่อนแถวเองได้ก็ต่อเมื่อรู้ว่าค่าเป็น null
    expect(Object.keys(m)).toEqual(expect.arrayContaining([
      'ordersPerRiderHour', 'restaurantAcceptRate', 'refundRate', 'autoDispatchRate',
      'contributionPerOrderSatang', 'medianDeliveryMinutes', 'onTimeRate',
      'promptPayRate', 'repeatOrderRate',
    ]));
    // ยังไม่มีออร์เดอร์สักใบ = วัดไม่ได้ ไม่ใช่ศูนย์
    expect(m.medianDeliveryMinutes).toBeNull();
    expect(m.onTimeRate).toBeNull();
    expect(m.repeatOrderRate).toBeNull();
  });

  it('หน้าต่างเวลาตั้งต้น 30 วัน ต่างจาก AD1 ที่มองสั้นกว่า', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    expect((await repos.super.metrics()).windowDays).toBe(30);
    expect((await repos.super.metrics(7)).windowDays).toBe(7);
  });
});

describe('ซูเปอร์แอดมิน — ราคา (SA6)', () => {
  it('ค่าตั้งต้นคือ 15% ตาม product-spec §6.1', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    const { pricing } = await repos.super.config();
    expect(pricing.commissionRateBp).toBe(1500);
    // ยังไม่เคยมีใครแก้ = null ไม่ใช่เวลาปลอมของตอนสร้าง state
    expect(pricing.updatedAt).toBeNull();
  });

  it('เปลี่ยนค่าคอมแล้วลง audit ทั้งค่าเก่าและค่าใหม่ — §6.1 ห้ามเลื่อนเงียบ ๆ', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await repos.super.setPricing({
      commissionRateBp: 1200,
      deliveryBaseSatang: 1500,
      deliveryPerKmSatang: 600,
      serviceFeeSatang: 500,
    });

    expect((await repos.super.config()).pricing.commissionRateBp).toBe(1200);

    const rows = await repos.super.audit('pricing.changed');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.before).toMatchObject({ commissionRateBp: 1500 });
    expect(rows[0]!.after).toMatchObject({ commissionRateBp: 1200 });
    expect(rows[0]!.actorUsername).toBe('super_root');
  });

  it('ค่าที่ไม่ใช่จำนวนเต็มสตางค์ถูกปฏิเสธ — เงินเป็นจำนวนเต็มเสมอ (§5 ข้อ 1)', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await expect(repos.super.setPricing({
      commissionRateBp: 1500,
      deliveryBaseSatang: 1500.5,
      deliveryPerKmSatang: 600,
      serviceFeeSatang: 500,
    })).rejects.toThrow();
  });
});

describe('ซูเปอร์แอดมิน — feature flag (SA4)', () => {
  it('ปิด cash_payment แล้วเงินสดหลุดจากช่องทางที่แอปเห็นจริง', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    expect((await repos.config.get()).paymentMethods).toContain('cash');

    await repos.super.setFlag('cash_payment', false);

    // flag ต้องมีผลกับพฤติกรรมจริง ไม่ใช่แค่ค่าที่จอตัวเองอ่านกลับมา (สเปค §5.4)
    expect((await repos.config.get()).paymentMethods).not.toContain('cash');
    expect((await repos.super.config()).flags.cash_payment).toBe(false);
  });

  it('พร้อมเพย์ปิดไม่ได้ — ไม่มี flag ให้ปิด (product-spec §3 ข้อ 5)', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    const { flagKeys } = await repos.super.config();
    expect(flagKeys).not.toContain('promptpay_payment');
    expect(flagKeys).toEqual([
      'cash_payment', 'card_payment', 'auto_dispatch', 'registration_open',
    ]);
  });

  it('ปิด registration_open แล้วค่าที่แอปอ่านตอนเปิดแอปเปลี่ยนตาม', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await repos.super.setFlag('registration_open', false);
    expect((await repos.config.get()).registrationOpen).toBe(false);
  });

  it('สลับ flag ลง audit', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await repos.super.setFlag('auto_dispatch', false);
    const rows = await repos.super.audit('flag.changed');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.subjectId).toBe('auto_dispatch');
    expect(rows[0]!.after).toMatchObject({ enabled: false });
  });
});

describe('ซูเปอร์แอดมิน — บทบาท (SA3)', () => {
  it('รายชื่อมีเฉพาะบัญชีผู้ดูแลระบบ', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    const rows = await repos.super.admins();
    expect(rows.map((r) => r.username).sort()).toEqual(['admin_root', 'super_root']);
  });

  it('ถอนสิทธิ์ตัวเองไม่ได้ — ไม่งั้นล็อกตัวเองออกจากระบบโดยกู้คืนไม่ได้', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await expect(repos.super.setRole('u-super', 'user')).rejects.toThrow();
  });

  it('ยกแอดมินขึ้นเป็นซูเปอร์แอดมินได้ และลง audit พร้อมค่าเก่า', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await repos.super.setRole('u-admin', 'super_admin');

    const rows = await repos.super.audit('role.changed');
    expect(rows[0]!.before).toMatchObject({ role: 'admin' });
    expect(rows[0]!.after).toMatchObject({ role: 'super_admin' });
    expect((await repos.super.admins()).find((r) => r.accountId === 'u-admin')!.role)
      .toBe('super_admin');
  });

  it('บัญชีไรเดอร์เปลี่ยนเป็นผู้ดูแลระบบไม่ได้', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await expect(repos.super.setRole('u-ann', 'admin')).rejects.toThrow();
  });
});

describe('ซูเปอร์แอดมิน — โซน (SA2)', () => {
  it('สร้างโซนแล้วโผล่ในรายการพร้อมตัวเลขของมัน', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    const created = await repos.super.createZone({
      name: 'สยาม', type: 'office_district', lat: 13.7457, lng: 100.5331,
    });

    const list = await repos.super.zones();
    expect(list.map((z) => z.id)).toContain(created.id);
    const siam = list.find((z) => z.id === created.id)!;
    expect(siam.name).toBe('สยาม');
    expect(siam.type).toBe('office_district');
  });

  it('แก้ชื่อโซนแล้วรายการเปลี่ยนตาม', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await repos.super.updateZone('z-ari', {
      name: 'อารีย์–สะพานควาย', type: 'mixed', lat: 13.7797, lng: 100.5442,
    });
    const list = await repos.super.zones();
    expect(list.find((z) => z.id === 'z-ari')!.name).toBe('อารีย์–สะพานควาย');
  });
});

describe('ซูเปอร์แอดมิน — ประวัติ (SA5)', () => {
  it('กรองตามชนิดได้ และเรียงใหม่สุดขึ้นก่อน', async () => {
    const repos = createMockRepos();
    await asSuper(repos);
    await repos.super.setFlag('auto_dispatch', false);
    await repos.super.setFlag('card_payment', false);

    const all = await repos.super.audit();
    expect(all.length).toBe(2);
    expect(all[0]!.subjectId).toBe('card_payment');
    expect((await repos.super.audit('role.changed'))).toHaveLength(0);
  });
});
