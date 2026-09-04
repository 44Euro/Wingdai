import {
  applyFilters, DEFAULT_FILTERS, isDefaultFilters, priceTierOf, sortRestaurants,
} from '../../src/features/customer/filters';
import { FALLBACK_PRICING } from '../../src/features/cart/pricing';
import type { Restaurant } from '../../src/data/types';

const shop = (over: Partial<Restaurant> & { id: string }): Restaurant => ({
  ownerUserId: 'u-x', name: over.id, isApproved: true, isOpen: true, cuisine: 'rice',
  distanceKm: 1, prepTimeMinutes: 10, rating: null, opensAt: null, ...over,
});

describe('sortRestaurants (C35)', () => {
  it('ใกล้ที่สุดเรียงจากน้อยไปมาก', () => {
    const list = [shop({ id: 'far', distanceKm: 3 }), shop({ id: 'near', distanceKm: 0.5 })];
    expect(sortRestaurants(list, 'nearest').map((r) => r.id)).toEqual(['near', 'far']);
  });

  it('คะแนนสูงสุดเรียงจากมากไปน้อย และร้านที่ไม่มีคะแนนไปท้าย', () => {
    const list = [
      shop({ id: 'none', rating: null }),
      shop({ id: 'good', rating: 4.2 }),
      shop({ id: 'best', rating: 4.9 }),
    ];
    // ไม่มีคะแนน ≠ ศูนย์ดาว ถ้านับเป็นศูนย์ ร้านใหม่จะจมท้ายตลอดกาลและไม่มีวันได้รีวิวแรก
    expect(sortRestaurants(list, 'topRated').map((r) => r.id)).toEqual(['best', 'good', 'none']);
  });

  it('ทำเร็วที่สุดใช้เวลาทำอาหารของร้าน ไม่ใช่ความเร็วไรเดอร์', () => {
    const list = [shop({ id: 'slow', prepTimeMinutes: 25 }), shop({ id: 'quick', prepTimeMinutes: 8 })];
    expect(sortRestaurants(list, 'fastest').map((r) => r.id)).toEqual(['quick', 'slow']);
  });

  it('แนะนำ = ร้านที่เปิดอยู่มาก่อน แล้วเรียงตามระยะ', () => {
    const list = [
      shop({ id: 'closedNear', isOpen: false, distanceKm: 0.2 }),
      shop({ id: 'openFar', distanceKm: 4 }),
      shop({ id: 'openNear', distanceKm: 1 }),
    ];
    expect(sortRestaurants(list, 'recommended').map((r) => r.id))
      .toEqual(['openNear', 'openFar', 'closedNear']);
  });

  it('ไม่แก้รายการต้นฉบับ', () => {
    const list = [shop({ id: 'b', distanceKm: 2 }), shop({ id: 'a', distanceKm: 1 })];
    sortRestaurants(list, 'nearest');
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('applyFilters (C35)', () => {
  it('ค่าตั้งต้นไม่กรองอะไรออก', () => {
    const list = [shop({ id: 'a' }), shop({ id: 'b', isOpen: false, rating: 2 })];
    expect(applyFilters(list, DEFAULT_FILTERS, FALLBACK_PRICING)).toHaveLength(2);
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it('เฉพาะร้านที่เปิดอยู่', () => {
    const list = [shop({ id: 'open' }), shop({ id: 'closed', isOpen: false })];
    const out = applyFilters(list, { ...DEFAULT_FILTERS, openOnly: true }, FALLBACK_PRICING);
    expect(out.map((r) => r.id)).toEqual(['open']);
  });

  it('คะแนนขั้นต่ำตัดร้านที่ยังไม่มีใครรีวิวออกด้วย', () => {
    const list = [shop({ id: 'rated', rating: 4.6 }), shop({ id: 'unrated', rating: null })];
    const out = applyFilters(list, { ...DEFAULT_FILTERS, minRating: 4.5 }, FALLBACK_PRICING);
    // "ไม่รู้" ไม่ใช่ "ผ่าน" คนที่ขอ 4.5+ ไม่ได้ขอร้านที่ไม่รู้คะแนน
    expect(out.map((r) => r.id)).toEqual(['rated']);
  });

  it('ค่าส่งไม่เกิน ตัดร้านที่ไกลจนค่าส่งเกิน', () => {
    // ฐาน ฿15 + ฿6 ต่อกิโลหลังกิโลแรก → 1 กม. = ฿15 3 กม. = ฿27
    const list = [shop({ id: 'near', distanceKm: 1 }), shop({ id: 'far', distanceKm: 3 })];
    const out = applyFilters(list, { ...DEFAULT_FILTERS, maxDeliveryFeeSatang: 2100 }, FALLBACK_PRICING);
    expect(out.map((r) => r.id)).toEqual(['near']);
  });

  it('ยังไม่รู้ระยะ = ไม่ตัดทิ้ง', () => {
    // คนที่ยังไม่ได้ใส่ที่อยู่ต้องไม่เจอจอว่างเปล่า (กติกาเดียวกับรัศมี §7)
    const list = [shop({ id: 'unknown', distanceKm: null })];
    const out = applyFilters(list, { ...DEFAULT_FILTERS, maxDeliveryFeeSatang: 1500 }, FALLBACK_PRICING);
    expect(out.map((r) => r.id)).toEqual(['unknown']);
  });

  it('ระดับราคากรองจากราคาเฉลี่ยที่ส่งเข้ามา และไม่ตัดร้านที่ไม่รู้ราคา', () => {
    const list = [shop({ id: 'cheap' }), shop({ id: 'pricey' }), shop({ id: 'unknown' })];
    const avg = (id: string) => (id === 'cheap' ? 5000 : id === 'pricey' ? 20000 : null);
    const out = applyFilters(list, { ...DEFAULT_FILTERS, priceTiers: [1] }, FALLBACK_PRICING, avg);
    expect(out.map((r) => r.id).sort()).toEqual(['cheap', 'unknown']);
  });

  it('กรองแล้วยังเรียงตามที่เลือกไว้', () => {
    const list = [
      shop({ id: 'a', distanceKm: 3, rating: 4.8 }),
      shop({ id: 'b', distanceKm: 1, rating: 4.6 }),
    ];
    const out = applyFilters(list, { ...DEFAULT_FILTERS, sort: 'nearest', minRating: 4.5 }, FALLBACK_PRICING);
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('priceTierOf', () => {
  it('แบ่งสามระดับตามเส้น ฿60 / ฿120', () => {
    expect(priceTierOf(4500)).toBe(1);
    expect(priceTierOf(6000)).toBe(1);
    expect(priceTierOf(6001)).toBe(2);
    expect(priceTierOf(12000)).toBe(2);
    expect(priceTierOf(15000)).toBe(3);
  });

  it('ไม่รู้ราคา = ไม่มีระดับ ไม่ใช่ระดับถูกสุด', () => {
    expect(priceTierOf(null)).toBeNull();
  });
});
