import { createMockRepos } from '../../src/data/mock';

/** จุดตั้งทำงาน (design R7) */
describe('จุดตั้งทำงานของไรเดอร์', () => {
  it('ยังไม่เคยตั้ง ได้ null ไม่ใช่พิกัด 0,0', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    expect(await repos.rider.workBase()).toBeNull();
  });

  it('ตั้งแล้วอ่านกลับมาได้เท่าเดิม', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await repos.rider.setWorkBase({ lat: 13.7802, lng: 100.5432, radiusKm: 3 });
    expect(await repos.rider.workBase()).toEqual({ lat: 13.7802, lng: 100.5432, radiusKm: 3 });
  });

  it('ตั้งทับของเดิมได้ ไม่สะสมเป็นหลายจุด', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await repos.rider.setWorkBase({ lat: 13.78, lng: 100.54, radiusKm: 5 });
    await repos.rider.setWorkBase({ lat: 18.79, lng: 98.98, radiusKm: 2 });
    expect(await repos.rider.workBase()).toEqual({ lat: 18.79, lng: 98.98, radiusKm: 2 });
  });

  it('รัศมีนอกช่วงถูกปฏิเสธ ทั้งเล็กเกินและใหญ่เกิน', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await expect(repos.rider.setWorkBase({ lat: 13.78, lng: 100.54, radiusKm: 0 })).rejects.toThrow();
    await expect(repos.rider.setWorkBase({ lat: 13.78, lng: 100.54, radiusKm: 99 })).rejects.toThrow();
  });

  it('จุดทำงานเป็นของแต่ละคน ไม่ปนกัน', async () => {
    const repos = createMockRepos();
    await repos.auth.login('rider_ann', '1234');
    await repos.rider.setWorkBase({ lat: 13.78, lng: 100.54, radiusKm: 3 });

    // rider_new เป็นบัญชีไรเดอร์อีกคนใน seed (ยังรออนุมัติ) อ่านจุดทำงานของตัวเองได้
    await repos.auth.login('rider_new', '1234');
    expect(await repos.rider.workBase()).toBeNull();
  });
});
