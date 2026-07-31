import { describe, it, expect } from 'vitest';
import {
  ineligibleReason, isEligible,
  type RiderEligibilityInput, type JobEligibilityInput,
} from './eligibility';

const TODAY = '2026-07-31';

const rider = (over: Partial<RiderEligibilityInput> = {}): RiderEligibilityInput => ({
  accountId: 'rider-1',
  approval: 'approved',
  isOnline: true,
  cashHeldSatang: 0,
  cashLimitSatang: 150_000,
  licenceExpiry: '2029-12-31',
  compulsoryInsuranceExpiry: '2027-06-30',
  // ยังไม่ปักหมุดจุดตั้งทำงาน = ไม่กรองด้วยรัศมี (ค่าเริ่มต้นของไรเดอร์ส่วนใหญ่)
  baseDistanceKm: null,
  baseRadiusKm: 5,
  ...over,
});

const job = (over: Partial<JobEligibilityInput> = {}): JobEligibilityInput => ({
  customerId: 'customer-1',
  paymentMethod: 'promptpay',
  paymentStatus: 'paid',
  grossSatang: 15_000,
  ...over,
});

const check = (r: Partial<RiderEligibilityInput>, j: Partial<JobEligibilityInput> = {}, declined: string[] = []) =>
  ineligibleReason({
    rider: rider(r),
    job: job(j),
    declinedBy: new Set(declined),
    today: TODAY,
  });

describe('ใครรับงานได้บ้าง', () => {
  it('ไรเดอร์อนุมัติแล้ว ออนไลน์อยู่ ไม่ใช่คนสั่งเอง → รับได้', () => {
    expect(check({})).toBeNull();
    expect(isEligible({ rider: rider(), job: job(), declinedBy: new Set(), today: TODAY })).toBe(true);
  });

  it('ยังไม่ผ่านอนุมัติรับงานไม่ได้', () => {
    expect(check({ approval: 'pending' })).toBe('not_approved');
    expect(check({ approval: 'rejected' })).toBe('not_approved');
  });

  it('ออฟไลน์อยู่ไม่ถูกเสนองาน', () => {
    expect(check({ isOnline: false })).toBe('offline');
  });

  /** product-spec §4.3 ต้องตรวจที่เซิร์ฟเวอร์ตอนจ่ายงาน ไม่ใช่แค่ซ่อนปุ่มในแอป */
  it('ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้', () => {
    expect(check({ accountId: 'same' }, { customerId: 'same' })).toBe('own_order');
  });

  it('ปฏิเสธไปแล้วไม่ถูกเสนอซ้ำ', () => {
    expect(check({ accountId: 'r9' }, {}, ['r9'])).toBe('already_declined');
  });

  it('ใบขับขี่หมดอายุแล้วห้ามจ่ายงาน', () => {
    expect(check({ licenceExpiry: '2026-07-30' })).toBe('licence_expired');
  });

  it('พ.ร.บ. หมดอายุแล้วห้ามจ่ายงาน', () => {
    expect(check({ compulsoryInsuranceExpiry: '2026-07-30' })).toBe('insurance_expired');
  });

  it('หมดอายุวันนี้พอดียังใช้ได้', () => {
    expect(check({ licenceExpiry: TODAY })).toBeNull();
  });

  describe('เพดานเงินสด (§6.2)', () => {
    it('ถือเงินจนเกินเพดานแล้วไม่ได้งานเงินสดต่อ', () => {
      expect(
        check(
          { cashHeldSatang: 145_000, cashLimitSatang: 150_000 },
          { paymentMethod: 'cash', paymentStatus: 'pending', grossSatang: 10_000 },
        ),
      ).toBe('cash_limit');
    });

    it('พอดีเพดานยังรับได้', () => {
      expect(
        check(
          { cashHeldSatang: 140_000, cashLimitSatang: 150_000 },
          { paymentMethod: 'cash', paymentStatus: 'pending', grossSatang: 10_000 },
        ),
      ).toBeNull();
    });

    /** ใบที่ลูกค้าเปลี่ยนไปจ่ายพร้อมเพย์แล้ว (§6.5) ไม่มีเงินสดให้เก็บ จึงไม่ชนเพดาน */
    it('ใบที่จ่ายแล้วไม่นับเข้าเพดานเงินสด', () => {
      expect(
        check(
          { cashHeldSatang: 149_000, cashLimitSatang: 150_000 },
          { paymentMethod: 'cash', paymentStatus: 'paid', grossSatang: 10_000 },
        ),
      ).toBeNull();
    });

    it('ใบพร้อมเพย์ไม่เกี่ยวกับเพดานเงินสด', () => {
      expect(
        check(
          { cashHeldSatang: 149_000, cashLimitSatang: 150_000 },
          { paymentMethod: 'promptpay', paymentStatus: 'paid', grossSatang: 50_000 },
        ),
      ).toBeNull();
    });
  });

  /** เอกสารหมดอายุร้ายแรงกว่าออฟไลน์ ต้องเห็นเหตุผลนั้นก่อนในจอแอดมิน */
  it('รายงานเหตุผลที่ร้ายแรงที่สุดก่อน', () => {
    expect(check({ approval: 'pending', isOnline: false, licenceExpiry: '2020-01-01' })).toBe(
      'not_approved',
    );
    expect(check({ isOnline: false, licenceExpiry: '2020-01-01' })).toBe('licence_expired');
  });
});

/** design R7 จุดตั้งทำงานต้องมีผลจริงกับการคัดผู้รับงาน */
describe('จุดตั้งทำงาน (R7)', () => {
  it('ยังไม่ปักหมุด รับงานได้ทุกที่เหมือนเดิม', () => {
    expect(
      ineligibleReason({
        rider: rider({ baseDistanceKm: null }),
        job: job(), declinedBy: new Set(), today: TODAY,
      }),
    ).toBeNull();
  });

  it('ร้านอยู่ในรัศมีที่ตั้งไว้ รับได้', () => {
    expect(
      ineligibleReason({
        rider: rider({ baseDistanceKm: 1.8, baseRadiusKm: 2 }),
        job: job(), declinedBy: new Set(), today: TODAY,
      }),
    ).toBeNull();
  });

  it('ร้านอยู่นอกรัศมี ไม่ถูกเสนอ พร้อมบอกเหตุผลที่อ่านออก', () => {
    expect(
      ineligibleReason({
        rider: rider({ baseDistanceKm: 4, baseRadiusKm: 2 }),
        job: job(), declinedBy: new Set(), today: TODAY,
      }),
    ).toBe('outside_work_base');
  });

  /** เป็นด่านห้าม ไม่ใช่คะแนนติดลบ เรื่องร้ายแรงกว่าต้องยังมาก่อน */
  it('บัญชียังไม่อนุมัติ ต้องได้เหตุผลนั้นก่อน ไม่ใช่เรื่องรัศมี', () => {
    expect(
      ineligibleReason({
        rider: rider({ approval: 'pending', baseDistanceKm: 99, baseRadiusKm: 2 }),
        job: job(), declinedBy: new Set(), today: TODAY,
      }),
    ).toBe('not_approved');
  });
});
