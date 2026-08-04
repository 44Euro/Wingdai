import { describe, it, expect } from 'vitest';
import {
  DELAYED_AFTER_MINUTES, isDelayed, isUnassigned, matchesFilter, type AdminOrderRow,
} from './adminOrders';
import { isActiveStatus } from './stateMachine';

function row(over: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: 'o-1',
    reference: 'WD-ABC123',
    status: 'preparing',
    restaurantName: 'ครัวบ้านอารีย์',
    dropoffLabel: 'พหลโยธิน 7',
    riderName: null,
    grandTotalSatang: 17000,
    createdAt: '2026-08-04T03:00:00.000Z',
    minutesElapsed: 5,
    ...over,
  };
}

/** ยืนยันสมมติฐานที่ทั้งไฟล์นี้ตั้งอยู่บน ถ้าวันหนึ่งมีสถานะใหม่ที่ยังเดินต่อได้ */
describe('สมมติฐานเรื่องสถานะที่ยังเดินอยู่', () => {
  it('สี่สถานะแรกยังเดินอยู่ สองสถานะท้ายจบแล้ว', () => {
    expect(isActiveStatus('created')).toBe(true);
    expect(isActiveStatus('accepted')).toBe(true);
    expect(isActiveStatus('preparing')).toBe(true);
    expect(isActiveStatus('picked_up')).toBe(true);
    expect(isActiveStatus('delivered')).toBe(false);
    expect(isActiveStatus('cancelled')).toBe(false);
  });
});

describe('isDelayed', () => {
  it('เกินเกณฑ์แล้วถือว่าช้า', () => {
    expect(isDelayed(row({ minutesElapsed: DELAYED_AFTER_MINUTES + 1 }))).toBe(true);
  });

  it('ที่เกณฑ์พอดียังไม่ช้า — §8 บอกว่าค่ากลางต้อง "ต่ำกว่า" 30 นาที', () => {
    expect(isDelayed(row({ minutesElapsed: DELAYED_AFTER_MINUTES }))).toBe(false);
  });

  /** ออร์เดอร์ที่ส่งถึงแล้วเมื่อสองชั่วโมงก่อนไม่ใช่ "ออร์เดอร์ที่ช้าอยู่ตอนนี้" */
  it('ออร์เดอร์ที่จบแล้วไม่เคยนับว่าช้า ต่อให้ผ่านมานานแค่ไหน', () => {
    expect(isDelayed(row({ status: 'delivered', minutesElapsed: 999 }))).toBe(false);
    expect(isDelayed(row({ status: 'cancelled', minutesElapsed: 999 }))).toBe(false);
  });
});

describe('isUnassigned', () => {
  it('ยังเดินอยู่และไม่มีไรเดอร์ = ต้องหาคนให้', () => {
    expect(isUnassigned(row({ riderName: null }))).toBe(true);
  });

  it('มีไรเดอร์แล้วไม่นับ', () => {
    expect(isUnassigned(row({ riderName: 'อรรถ' }))).toBe(false);
  });

  /** ยกเลิกไปแล้วไม่มีไรเดอร์เป็นเรื่องปกติ ไม่ใช่ปัญหาที่ต้องแก้ */
  it('ออร์เดอร์ที่จบแล้วไม่นับว่าไม่มีไรเดอร์', () => {
    expect(isUnassigned(row({ status: 'cancelled', riderName: null }))).toBe(false);
    expect(isUnassigned(row({ status: 'delivered', riderName: 'อรรถ' }))).toBe(false);
  });
});

describe('matchesFilter', () => {
  const fresh = row({ minutesElapsed: 3, riderName: 'อรรถ' });
  const late = row({ id: 'o-2', minutesElapsed: 40, riderName: 'อรรถ' });
  const orphan = row({ id: 'o-3', minutesElapsed: 3, riderName: null });
  const done = row({ id: 'o-4', status: 'delivered', minutesElapsed: 90, riderName: 'อรรถ' });
  const all = [fresh, late, orphan, done];

  it('"ทั้งหมด" คืนทุกใบรวมที่จบแล้ว', () => {
    expect(all.filter((r) => matchesFilter('all', r)).map((r) => r.id))
      .toEqual(['o-1', 'o-2', 'o-3', 'o-4']);
  });

  it('"ช้า" เหลือเฉพาะใบที่ยังวิ่งและเกินเกณฑ์', () => {
    expect(all.filter((r) => matchesFilter('delayed', r)).map((r) => r.id)).toEqual(['o-2']);
  });

  it('"ไม่มีไรเดอร์" เหลือเฉพาะใบที่ยังวิ่งและยังไม่มีคนรับ', () => {
    expect(all.filter((r) => matchesFilter('unassigned', r)).map((r) => r.id)).toEqual(['o-3']);
  });

  it('ตัวกรองสามค่าให้ผลต่างกันจริง ไม่ใช่ชื่อต่างแต่ผลเหมือน', () => {
    const counts = (['all', 'delayed', 'unassigned'] as const)
      .map((f) => all.filter((r) => matchesFilter(f, r)).length);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });
});
