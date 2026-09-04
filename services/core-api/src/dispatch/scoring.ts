/** การให้คะแนนไรเดอร์เพื่อเลือกคนที่จะเสนองานให้ก่อน (product-spec §6.3) */

export type DispatchWeights = {
  /** ใกล้ร้าน */
  distance: number;
  /** ว่างงานมานาน ตัวกระจายงาน */
  fairness: number;
  /** อัตราส่งสำเร็จ */
  completion: number;
  /** งานที่ถืออยู่ตอนนี้ หักคะแนน */
  activeJobs: number;
};

/** ค่าตั้งต้นวันแรก ไม่มีข้อมูลจริงให้จูน §6.3 สั่งให้เฝ้าดูแล้วปรับ */
export const DEFAULT_WEIGHTS: DispatchWeights = {
  distance: 0.5,
  fairness: 0.25,
  completion: 0.15,
  activeJobs: 0.35,
};

/** เกินระยะนี้ถือว่าไกลเท่ากันหมด โซนเดียวกว้างราว 1–1.5 กม. (§1) */
export const FAR_KM = 3;
/** ว่างเกินนี้ถือว่า "รอนานสุด" เท่ากัน ไม่ให้คนที่ลืมออฟไลน์ทั้งวันชนะตลอด */
export const MAX_IDLE_SECONDS = 20 * 60;
/** ถือพร้อมกันเกินนี้ = เต็มมือ ไม่เสนองานให้อีก จ่ายทีละใบเสมอ §6.3 ยังไม่รวมงาน */
export const MAX_ACTIVE_JOBS = 3;

/** รัศมีทำงานเริ่มต้นของไรเดอร์ (design R7) */
export const DEFAULT_WORK_RADIUS_KM = 5;

/** ไรเดอร์ตั้งจุดตั้งต้นกับรัศมีที่ยอมรับงานเอง (design R7) */
export function isWithinWorkBase(args: {
  distanceFromBaseKm: number;
  radiusKm: number;
}): boolean {
  if (!Number.isFinite(args.distanceFromBaseKm) || args.distanceFromBaseKm < 0) return false;
  return args.distanceFromBaseKm <= args.radiusKm;
}

export type RiderCandidate = {
  accountId: string;
  distanceKm: number;
  idleSeconds: number;
  /** 0–1 ไรเดอร์ใหม่ที่ยังไม่เคยส่งให้ใช้ 1 ไปก่อน ไม่ใช่ 0 (ดู completionRateOf) */
  completionRate: number;
  activeJobs: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** อัตราส่งสำเร็จของไรเดอร์ ยังไม่เคยรับงานเลยให้ 1 */
export function completionRateOf(completed: number, assigned: number): number {
  if (assigned <= 0) return 1;
  return clamp01(completed / assigned);
}

export function scoreRider(rider: RiderCandidate, w: DispatchWeights = DEFAULT_WEIGHTS): number {
  // ใกล้ = 1, ไกลเกิน FAR_KM = 0 ใช้เส้นตรงแทน 1/d เพราะ 1/d ระเบิดเมื่อ d → 0
  const nearness = clamp01(1 - rider.distanceKm / FAR_KM);
  const fairness = clamp01(rider.idleSeconds / MAX_IDLE_SECONDS);
  const completion = clamp01(rider.completionRate);
  const load = clamp01(rider.activeJobs / MAX_ACTIVE_JOBS);

  return (
    w.distance * nearness +
    w.fairness * fairness +
    w.completion * completion -
    w.activeJobs * load
  );
}

/** เรียงลำดับคนที่จะเสนองานให้ คะแนนสูงสุดก่อน */
export function rankRiders(
  riders: RiderCandidate[],
  w: DispatchWeights = DEFAULT_WEIGHTS,
): RiderCandidate[] {
  return [...riders].sort((a, b) => {
    const diff = scoreRider(b, w) - scoreRider(a, w);
    return diff !== 0 ? diff : a.accountId.localeCompare(b.accountId);
  });
}

/** ไรเดอร์มี 15 วินาทีตอบรับ ตาม §6.3 หมดเวลาแล้วเลื่อนไปคนถัดไป */
export const OFFER_TIMEOUT_MS = 15_000;

/** ความเร็วเฉลี่ยของมอเตอร์ไซค์ในโซนหนาแน่น (กม./ชม.) */
export const CITY_SPEED_KMH = 18;

export function travelSecondsFor(distanceKm: number): number {
  return Math.round((distanceKm / CITY_SPEED_KMH) * 3600);
}

/** ถึงเวลาจ่ายงานหรือยัง §6.3 */
export function shouldDispatchNow(args: {
  predictedReadyAt: Date | null;
  nearestRiderDistanceKm: number;
  now: number;
}): boolean {
  // ไม่รู้ว่าอาหารจะเสร็จเมื่อไหร่ = จ่ายเลย ดีกว่าปล่อยออเดอร์ค้างไม่มีใครไปรับ
  if (!args.predictedReadyAt) return true;
  const leadMs = travelSecondsFor(args.nearestRiderDistanceKm) * 1000;
  return args.now >= args.predictedReadyAt.getTime() - leadMs;
}
