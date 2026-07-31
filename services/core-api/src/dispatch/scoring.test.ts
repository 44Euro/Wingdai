import { describe, it, expect } from 'vitest';
import {
  scoreRider, rankRiders, completionRateOf, shouldDispatchNow, travelSecondsFor,
  DEFAULT_WEIGHTS, FAR_KM, MAX_IDLE_SECONDS, CITY_SPEED_KMH,
  type RiderCandidate,
} from './scoring';

const rider = (over: Partial<RiderCandidate> = {}): RiderCandidate => ({
  accountId: 'r1',
  distanceKm: 1,
  idleSeconds: 0,
  completionRate: 1,
  activeJobs: 0,
  ...over,
});

describe('ให้คะแนนไรเดอร์ (claude.md §6.3)', () => {
  it('ใกล้ร้านกว่าได้คะแนนมากกว่า เมื่อทุกอย่างอื่นเท่ากัน', () => {
    const near = scoreRider(rider({ accountId: 'a', distanceKm: 0.3 }));
    const far = scoreRider(rider({ accountId: 'b', distanceKm: 2.5 }));
    expect(near).toBeGreaterThan(far);
  });

  /** 1/d ระเบิดเป็นอนันต์เมื่อไรเดอร์ยืนอยู่หน้าร้านพอดี — ต้องไม่มีทางเกิด NaN/Infinity */
  it('ระยะทางศูนย์ไม่ทำให้คะแนนเป็นอนันต์', () => {
    const s = scoreRider(rider({ distanceKm: 0 }));
    expect(Number.isFinite(s)).toBe(true);
  });

  it('ไกลเกินขอบเขตโซนไม่ติดลบเพิ่มเรื่อย ๆ', () => {
    expect(scoreRider(rider({ distanceKm: FAR_KM }))).toBe(
      scoreRider(rider({ distanceKm: FAR_KM * 10 })),
    );
  });

  /** ถ้าไม่ normalize idleSeconds หลักพันจะกลบทุกพจน์ จน w1..w4 ปรับอะไรไม่ได้จริง */
  it('คนที่ว่างมานานได้คะแนนกระจายงานมากกว่า แต่ไม่กลบทุกอย่าง', () => {
    const waiting = scoreRider(rider({ accountId: 'a', idleSeconds: MAX_IDLE_SECONDS }));
    const busy = scoreRider(rider({ accountId: 'b', idleSeconds: 0 }));
    expect(waiting).toBeGreaterThan(busy);
    expect(waiting - busy).toBeCloseTo(DEFAULT_WEIGHTS.fairness, 5);
  });

  it('งานที่ถืออยู่หักคะแนน', () => {
    expect(scoreRider(rider({ activeJobs: 2 }))).toBeLessThan(scoreRider(rider({ activeJobs: 0 })));
  });

  it('เรียงจากคะแนนสูงไปต่ำ', () => {
    const ranked = rankRiders([
      rider({ accountId: 'far', distanceKm: 2.8 }),
      rider({ accountId: 'near', distanceKm: 0.2 }),
      rider({ accountId: 'mid', distanceKm: 1.4 }),
    ]);
    expect(ranked.map((r) => r.accountId)).toEqual(['near', 'mid', 'far']);
  });

  /** ผลลัพธ์ต้องเหมือนเดิมทุกครั้ง ไม่งั้นบั๊กการจ่ายงานจะทำซ้ำไม่ได้ */
  it('คะแนนเท่ากันเรียงเหมือนเดิมทุกครั้ง ไม่ขึ้นกับลำดับที่ส่งเข้ามา', () => {
    const a = rider({ accountId: 'bbb' });
    const b = rider({ accountId: 'aaa' });
    expect(rankRiders([a, b]).map((r) => r.accountId)).toEqual(['aaa', 'bbb']);
    expect(rankRiders([b, a]).map((r) => r.accountId)).toEqual(['aaa', 'bbb']);
  });

  /**
   * ไรเดอร์ใหม่ต้องได้งานแรก ไม่งั้นไม่มีวันมีสถิติ แล้วก็ไม่มีวันได้งาน
   * — วงจรนี้ปิดประตูรับสมัครไรเดอร์ ซึ่งเป็นทรัพยากรที่โมเดลทั้งหมดพึ่งอยู่
   */
  it('ไรเดอร์ที่ยังไม่เคยรับงานได้อัตราสำเร็จ 1 ไม่ใช่ 0', () => {
    expect(completionRateOf(0, 0)).toBe(1);
    expect(completionRateOf(8, 10)).toBe(0.8);
  });

  it('อัตราสำเร็จอยู่ในช่วง 0–1 เสมอ แม้ข้อมูลเพี้ยน', () => {
    expect(completionRateOf(15, 10)).toBe(1);
    expect(completionRateOf(-3, 10)).toBe(0);
  });
});

describe('จังหวะจ่ายงาน — ห้ามให้ไรเดอร์ไปรอฟรี (§6.3)', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);

  it('อาหารเสร็จอีก 10 นาที ไรเดอร์อยู่ห่าง 1 กม. → ยังไม่ถึงเวลา', () => {
    expect(
      shouldDispatchNow({
        predictedReadyAt: new Date(now + 10 * 60_000),
        nearestRiderDistanceKm: 1,
        now,
      }),
    ).toBe(false);
  });

  it('อาหารใกล้เสร็จพอดีกับเวลาเดินทาง → จ่ายได้แล้ว', () => {
    const travelMs = travelSecondsFor(1) * 1000;
    expect(
      shouldDispatchNow({
        predictedReadyAt: new Date(now + travelMs),
        nearestRiderDistanceKm: 1,
        now,
      }),
    ).toBe(true);
  });

  it('อาหารเสร็จไปแล้ว → จ่ายทันที', () => {
    expect(
      shouldDispatchNow({ predictedReadyAt: new Date(now - 60_000), nearestRiderDistanceKm: 2, now }),
    ).toBe(true);
  });

  /** ไม่รู้เวลาเสร็จแล้วรอไว้ก่อน = ออร์เดอร์ค้างโดยไม่มีใครไปรับ ซึ่งแย่กว่าไรเดอร์รอ */
  it('ไม่รู้ว่าอาหารจะเสร็จเมื่อไหร่ → จ่ายเลย', () => {
    expect(
      shouldDispatchNow({ predictedReadyAt: null, nearestRiderDistanceKm: 1, now }),
    ).toBe(true);
  });

  it('เวลาเดินทางคิดจากความเร็วในเมือง ไม่ใช่ความเร็วที่ต้องเร่ง', () => {
    expect(travelSecondsFor(CITY_SPEED_KMH)).toBe(3600);
  });
});
