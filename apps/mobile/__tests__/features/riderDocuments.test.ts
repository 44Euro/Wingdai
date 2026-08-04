import { createMockRepos } from '../../src/data/mock';

/** เอกสารไรเดอร์ (design R8 product-spec §7) */
describe('เอกสารไรเดอร์ (R8)', () => {
  it('เอกสารครบหกชนิดตาม §7 และเริ่มที่ยังไม่อัป', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');

    const docs = await repos.rider.documents();
    expect(docs.map((d) => d.kind).sort()).toEqual([
      'id_card_back', 'id_card_front', 'insurance', 'licence', 'selfie', 'vehicle_book',
    ]);
    expect(docs.every((d) => d.status === 'missing')).toBe(true);
    expect(docs.every((d) => d.uploadedAt === null)).toBe(true);
  });

  /** อัปแล้วผ่านทันทีเท่ากับไม่มีการตรวจ แอดมินต้องเป็นคนกดผ่าน */
  it('อัปแล้วสถานะเปลี่ยนเป็นรอตรวจ ไม่ใช่ผ่านทันที', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');

    const doc = await repos.rider.uploadDocument('licence', { uri: 'file:///tmp/a.jpg', ext: 'jpg' });
    expect(doc.status).toBe('reviewing');
    expect(doc.uploadedAt).not.toBeNull();

    const docs = await repos.rider.documents();
    expect(docs.find((d) => d.kind === 'licence')!.status).toBe('reviewing');
  });

  it('อัปทับชนิดเดิมได้ ไม่สร้างซ้ำ', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');

    await repos.rider.uploadDocument('selfie', { uri: 'file:///tmp/a.jpg', ext: 'jpg' });
    await repos.rider.uploadDocument('selfie', { uri: 'file:///tmp/b.jpg', ext: 'jpg' });

    const docs = await repos.rider.documents();
    expect(docs.filter((d) => d.kind === 'selfie')).toHaveLength(1);
  });

  /** ส่งใหม่หลังถูกปฏิเสธ ต้องกลับไปรอตรวจและล้างเหตุผลเดิม */
  it('ส่งใหม่หลังถูกปฏิเสธ กลับไปรอตรวจและเหตุผลเดิมหายไป', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await repos.rider.uploadDocument('licence', { uri: 'file:///tmp/a.jpg', ext: 'jpg' });

    await repos.auth.login('admin_root', '1234');
    await repos.admin.decideRiderDocument('u-ann', 'licence', {
      approve: false,
      rejectionReason: 'รูปเบลอ อ่านเลขที่ใบขับขี่ไม่ออก',
    });

    await repos.auth.login('rider_ann', '1234');
    const rejected = (await repos.rider.documents()).find((d) => d.kind === 'licence')!;
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('รูปเบลอ อ่านเลขที่ใบขับขี่ไม่ออก');

    const resent = await repos.rider.uploadDocument('licence', { uri: 'file:///tmp/b.jpg', ext: 'jpg' });
    expect(resent.status).toBe('reviewing');
    expect(resent.rejectionReason).toBeNull();
  });

  it('เอกสารที่ถูกปฏิเสธต้องบอกเหตุผลเสมอ', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await repos.rider.uploadDocument('selfie', { uri: 'file:///tmp/a.jpg', ext: 'jpg' });

    await repos.auth.login('admin_root', '1234');
    await expect(
      repos.admin.decideRiderDocument('u-ann', 'selfie', { approve: false }),
    ).rejects.toThrow();
  });

  it('เอกสารเป็นของแต่ละคน ไม่ปนกัน', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await repos.rider.uploadDocument('selfie', { uri: 'file:///tmp/a.jpg', ext: 'jpg' });

    await repos.auth.login('rider_new', '1234');
    const docs = await repos.rider.documents();
    expect(docs.every((d) => d.status === 'missing')).toBe(true);
  });

  /** นามสกุลที่รันสคริปต์ได้ต้องถูกปฏิเสธตั้งแต่ชั้น repo เหมือนที่เซิร์ฟเวอร์ทำ */
  it('ไฟล์นามสกุลที่ไม่รองรับถูกปฏิเสธ', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await expect(
      repos.rider.uploadDocument('selfie', { uri: 'file:///tmp/a.svg', ext: 'svg' }),
    ).rejects.toThrow();
  });
});
