import {
  pingIntervalFor, isDelivering, DELIVERING_INTERVAL_MS, IDLE_INTERVAL_MS,
} from './locationPing';
import type { RiderJob } from '../../data/types';

const job = (status: RiderJob['status']): RiderJob => ({
  orderId: 'o1',
  reference: 'WD-AAAAAA',
  status,
  restaurantName: 'ครัวมาลี',
  restaurantAddress: 'ซอยอารีย์ 1',
  restaurantLat: 13.78,
  restaurantLng: 100.54,
  dropoffAddress: 'คอนโด',
  dropoffNote: null,
  dropoffLat: 13.781,
  dropoffLng: 100.541,
  items: [],
  riderPaySatang: 1500,
  collectCashSatang: 0,
});

describe('จังหวะส่งพิกัดของไรเดอร์ (claude.md §5)', () => {
  it('รับของแล้วกำลังไปส่ง = ส่งถี่', () => {
    expect(isDelivering([job('picked_up')])).toBe(true);
    expect(pingIntervalFor([job('picked_up')])).toBe(DELIVERING_INTERVAL_MS);
  });

  /**
   * ยังไม่ได้รับของ = ลูกค้ายังไม่ได้จ้องจอติดตาม ส่งถี่เท่ากันคือเผาแบตเปล่า
   * §5 บอกให้ผ่อนเป็น 15–30 วิ ตอนออนไลน์แต่ยังไม่ได้กำลังส่ง
   */
  it('รับงานแล้วแต่ยังไม่ได้รับของ = ส่งห่าง', () => {
    for (const s of ['accepted', 'preparing'] as const) {
      expect({ status: s, ms: pingIntervalFor([job(s)]) }).toEqual({ status: s, ms: IDLE_INTERVAL_MS });
    }
  });

  it('ไม่มีงานเลย = ส่งห่าง', () => {
    expect(isDelivering([])).toBe(false);
    expect(pingIntervalFor([])).toBe(IDLE_INTERVAL_MS);
  });

  /** ถืองานหลายใบแล้วมีใบไหนกำลังส่งอยู่ ก็ต้องส่งถี่ */
  it('ถือหลายงาน ใบไหนกำลังส่งก็ส่งถี่', () => {
    expect(pingIntervalFor([job('accepted'), job('picked_up')])).toBe(DELIVERING_INTERVAL_MS);
  });

  /** §5 ระบุช่วงไว้ชัด — เปลี่ยนค่าต้องรู้ตัวว่ากำลังออกนอกสเปค */
  it('ค่าที่ตั้งอยู่ในช่วงที่ claude.md §5 กำหนด', () => {
    expect(DELIVERING_INTERVAL_MS).toBeGreaterThanOrEqual(3_000);
    expect(DELIVERING_INTERVAL_MS).toBeLessThanOrEqual(5_000);
    expect(IDLE_INTERVAL_MS).toBeGreaterThanOrEqual(15_000);
    expect(IDLE_INTERVAL_MS).toBeLessThanOrEqual(30_000);
  });
});
