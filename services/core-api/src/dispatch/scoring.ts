/**
 * การให้คะแนนไรเดอร์เพื่อเลือกคนที่จะเสนองานให้ก่อน (claude.md §6.3)
 *
 * สูตรใน claude.md:
 *   score = w1 × (1 / distance_to_restaurant)
 *         + w2 × time_since_last_online      // fairness
 *         + w3 × completion_rate
 *         − w4 × current_active_jobs
 *
 * **สองจุดที่ตีความต่างจากตัวหนังสือ และตั้งใจให้ต่าง — ทบทวนได้:**
 *
 * 1. `time_since_last_online` ถ้าอ่านตรงตัวคือ "ออฟไลน์มานานแค่ไหน" ซึ่งจะให้คะแนนสูงกับ
 *    คนที่เพิ่งกลับมาออนไลน์ ไม่ใช่คนที่รอนาน — ขัดกับคำว่า fairness ที่กำกับไว้เอง
 *    ที่นี่จึงใช้ **"ว่างงานมานานแค่ไหน"** (idleSeconds) คือเวลาตั้งแต่จบงานล่าสุด
 *    หรือตั้งแต่ออนไลน์ถ้ายังไม่เคยได้งานเลย ซึ่งเป็นความหมายที่ทำให้งานกระจาย
 *
 * 2. **ทุกพจน์ถูกทำให้อยู่ในช่วง 0–1 ก่อนคูณน้ำหนัก** ถ้าไม่ทำ idleSeconds ที่เป็นหลักพัน
 *    จะกลบทุกอย่าง จน w1..w4 ไม่มีความหมาย — น้ำหนักจะปรับไม่ได้จริง
 *    ซึ่งเป็นปัญหาแน่ เพราะ §6.3 บอกให้เฝ้าดู Orders per Rider Hour แล้วปรับน้ำหนัก
 *
 * ไม่มีพจน์ไหนวัด "ความเร็ว" ของไรเดอร์เลย — claude.md §3 ข้อ 4 ห้ามสร้างแรงกดดันให้ขับเร็ว
 * ความเร็วมาจากระยะทางที่สั้น (ความหนาแน่นของโซน) ไม่ใช่จากการเร่งคน
 */

export type DispatchWeights = {
  /** ใกล้ร้าน */
  distance: number;
  /** ว่างงานมานาน — ตัวกระจายงาน */
  fairness: number;
  /** อัตราส่งสำเร็จ */
  completion: number;
  /** งานที่ถืออยู่ตอนนี้ — หักคะแนน */
  activeJobs: number;
};

/**
 * ค่าตั้งต้นวันแรก ไม่มีข้อมูลจริงให้จูน — §6.3 สั่งให้เฝ้าดูแล้วปรับ
 * ระยะทางหนักสุดเพราะเป็นตัวที่กระทบ Orders per Rider Hour ตรง ๆ (§8 เป้า ≥ 3.0)
 */
export const DEFAULT_WEIGHTS: DispatchWeights = {
  distance: 0.5,
  fairness: 0.25,
  completion: 0.15,
  activeJobs: 0.35,
};

/** เกินระยะนี้ถือว่าไกลเท่ากันหมด — โซนเดียวกว้างราว 1–1.5 กม. (§1) */
export const FAR_KM = 3;
/** ว่างเกินนี้ถือว่า "รอนานสุด" เท่ากัน ไม่ให้คนที่ลืมออฟไลน์ทั้งวันชนะตลอด */
export const MAX_IDLE_SECONDS = 20 * 60;
/** ถือพร้อมกันเกินนี้ = เต็มมือ (การรวมงานตาม §6.3 ทำได้ถึง 2 ใบ) */
export const MAX_ACTIVE_JOBS = 3;

export type RiderCandidate = {
  accountId: string;
  distanceKm: number;
  idleSeconds: number;
  /** 0–1 · ไรเดอร์ใหม่ที่ยังไม่เคยส่งให้ใช้ 1 ไปก่อน ไม่ใช่ 0 (ดู completionRateOf) */
  completionRate: number;
  activeJobs: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * อัตราส่งสำเร็จของไรเดอร์ — ยังไม่เคยรับงานเลยให้ 1
 *
 * ถ้าให้ 0 ไรเดอร์ใหม่จะไม่มีวันได้งานแรก เพราะแพ้ทุกคนที่เคยส่งสำเร็จ
 * แล้วก็ไม่มีวันมีสถิติ — เป็นวงจรที่ปิดประตูรับสมัครไรเดอร์ไปในตัว
 */
export function completionRateOf(completed: number, assigned: number): number {
  if (assigned <= 0) return 1;
  return clamp01(completed / assigned);
}

export function scoreRider(rider: RiderCandidate, w: DispatchWeights = DEFAULT_WEIGHTS): number {
  // ใกล้ = 1, ไกลเกิน FAR_KM = 0 · ใช้เส้นตรงแทน 1/d เพราะ 1/d ระเบิดเมื่อ d → 0
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

/**
 * เรียงลำดับคนที่จะเสนองานให้ — คะแนนสูงสุดก่อน
 *
 * คะแนนเท่ากันตัดสินด้วย accountId เพื่อให้ผลลัพธ์เหมือนเดิมทุกครั้ง
 * ไม่งั้นลำดับจะขึ้นกับลำดับที่ฐานส่งแถวมา ซึ่งทำให้บั๊กเรื่องการจ่ายงานไล่หาไม่เจอ
 */
export function rankRiders(
  riders: RiderCandidate[],
  w: DispatchWeights = DEFAULT_WEIGHTS,
): RiderCandidate[] {
  return [...riders].sort((a, b) => {
    const diff = scoreRider(b, w) - scoreRider(a, w);
    return diff !== 0 ? diff : a.accountId.localeCompare(b.accountId);
  });
}

/** ไรเดอร์มี 15 วินาทีตอบรับ ตาม §6.3 — หมดเวลาแล้วเลื่อนไปคนถัดไป */
export const OFFER_TIMEOUT_MS = 15_000;

/**
 * ความเร็วเฉลี่ยของมอเตอร์ไซค์ในโซนหนาแน่น (กม./ชม.)
 * ใช้ประมาณเวลาเดินทางเพื่อ **ตัดสินว่าจะจ่ายงานตอนไหน** ไม่ได้ใช้กดดันให้ขับเร็ว (§3 ข้อ 4)
 * ตั้งไว้ต่ำโดยตั้งใจ — จ่ายงานเร็วไปแล้วไรเดอร์รอฟรี แย่กว่าจ่ายช้าไปนิดเดียว
 */
export const CITY_SPEED_KMH = 18;

export function travelSecondsFor(distanceKm: number): number {
  return Math.round((distanceKm / CITY_SPEED_KMH) * 3600);
}

/**
 * ถึงเวลาจ่ายงานหรือยัง — §6.3
 *   dispatch_time = predicted_food_ready_time − rider_travel_time_to_restaurant
 *
 * ไรเดอร์ที่ถึงร้านก่อนอาหารเสร็จต้องรอฟรี รายได้ต่อชั่วโมงตก แล้วก็ลาออก
 * ซึ่งกระทบ Orders per Rider Hour (§8) ที่เป็น North Star โดยตรง
 */
export function shouldDispatchNow(args: {
  predictedReadyAt: Date | null;
  nearestRiderDistanceKm: number;
  now: number;
}): boolean {
  // ไม่รู้ว่าอาหารจะเสร็จเมื่อไหร่ = จ่ายเลย ดีกว่าปล่อยออร์เดอร์ค้างไม่มีใครไปรับ
  if (!args.predictedReadyAt) return true;
  const leadMs = travelSecondsFor(args.nearestRiderDistanceKm) * 1000;
  return args.now >= args.predictedReadyAt.getTime() - leadMs;
}
