import { interpolatePosition, progressBetweenPings, PING_INTERVAL_MS } from '../../src/lib/route';

/** การไหลของหมุดระหว่างจุด (product-spec §5 client-side interpolation) */
describe('การไหลของหมุดระหว่างจุด', () => {
  it('t=0 อยู่จุดเริ่ม t=1 อยู่จุดปลาย', () => {
    const a = { lat: 13.78, lng: 100.54 };
    const b = { lat: 13.79, lng: 100.55 };
    expect(interpolatePosition(a, b, 0)).toEqual(a);
    expect(interpolatePosition(a, b, 1)).toEqual(b);
  });

  it('t=0.5 อยู่กึ่งกลางพอดี', () => {
    const p = interpolatePosition({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 0.5);
    expect(p.lat).toBeCloseTo(5);
    expect(p.lng).toBeCloseTo(10);
  });

  /** ลากเลยปลายทางแปลว่าหมุดวิ่งไปที่ที่ไรเดอร์ไม่เคยอยู่ ต้องหยุดที่จุดล่าสุดเสมอ */
  it('t นอกช่วง 0–1 ถูกบีบเข้าช่วง ไม่วิ่งเลยปลายทาง', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 10, lng: 10 };
    expect(interpolatePosition(a, b, 1.8)).toEqual(b);
    expect(interpolatePosition(a, b, -0.5)).toEqual(a);
  });
});

describe('สัดส่วนเวลาระหว่างสองครั้งที่ส่งพิกัด', () => {
  it('เพิ่งได้พิกัดมา = 0', () => {
    expect(progressBetweenPings(0)).toBe(0);
  });

  it('ผ่านไปครึ่งช่วง = 0.5', () => {
    expect(progressBetweenPings(PING_INTERVAL_MS / 2)).toBeCloseTo(0.5);
  });

  /** พิกัดถัดไปมาช้ากว่ากำหนด (เน็ตไรเดอร์หลุด) หมุดต้องหยุดรอที่จุดล่าสุด */
  it('เลยช่วงไปแล้วยังค้างที่ 1 ไม่วิ่งต่อ', () => {
    expect(progressBetweenPings(PING_INTERVAL_MS * 5)).toBe(1);
  });

  it('เวลาติดลบ (นาฬิกาเครื่องเพี้ยน) ไม่ทำให้หมุดถอยหลัง', () => {
    expect(progressBetweenPings(-9999)).toBe(0);
  });

  /** §5 กำหนดให้ผู้ใช้เลือกไว้ที่นาทีละครั้ง ค่านี้เปลี่ยนแล้วต้องรู้ตัว */
  it('ช่วงอัปเดตคือหนึ่งนาที', () => {
    expect(PING_INTERVAL_MS).toBe(60_000);
  });
});
