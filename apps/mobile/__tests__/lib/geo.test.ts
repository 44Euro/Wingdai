import { haversineKm } from '../../src/lib/geo';

/** ระยะทางที่โชว์ให้ไรเดอร์ต้องเป็นตัวเลขที่คำนวณจากพิกัดจริง ไม่ใช่ค่าที่กรอกไว้ */
describe('haversineKm', () => {
  it('จุดเดียวกันได้ศูนย์', () => {
    expect(haversineKm({ lat: 13.78, lng: 100.54 }, { lat: 13.78, lng: 100.54 })).toBe(0);
  });

  /** 1 องศาละติจูด ≈ 111.19 กม. ที่ทุกละติจูด */
  it('ห่างกัน 1 องศาละติจูดได้ประมาณ 111 กม.', () => {
    const km = haversineKm({ lat: 13, lng: 100.5 }, { lat: 14, lng: 100.5 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  /** ระยะทางไม่มีทิศ สลับต้นทางปลายทางต้องได้เท่าเดิม */
  it('สลับสองจุดได้ค่าเท่าเดิม', () => {
    const a = { lat: 13.7815, lng: 100.545 };
    const b = { lat: 13.7761, lng: 100.545 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });

  it('ระยะสั้นระดับในเมืองยังแม่น — 0.6 กม. ต้องไม่กลายเป็น 0', () => {
    const km = haversineKm({ lat: 13.7815, lng: 100.545 }, { lat: 13.77611, lng: 100.545 });
    expect(km).toBeCloseTo(0.6, 1);
  });
});
