import { describe, it, expect } from 'vitest';
import {
  isValidThaiNationalId, ageOn, isExpired, validateRiderApplication,
  bankNameMatchesLegalName, MIN_AGE_YEARS,
} from './riderApplication';

/** วันอ้างอิงคงที่ เพื่อให้เทสต์ไม่พังเองเมื่อเวลาผ่านไป */
const NOW = new Date('2026-08-01T10:00:00Z');

/** สร้างเลขบัตรที่ checksum ถูกต้องจาก 12 หลักแรก */
function withCheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(first12[i]) * (13 - i);
  return first12 + String((11 - (sum % 11)) % 10);
}

describe('เลขบัตรประชาชนไทย', () => {
  it('เลขที่ checksum ถูกต้องผ่าน', () => {
    expect(isValidThaiNationalId(withCheckDigit('110170063579'))).toBe(true);
    expect(isValidThaiNationalId(withCheckDigit('310120345678'))).toBe(true);
  });

  /** จุดสำคัญ: นับหลักอย่างเดียวไม่พอ เลขมั่ว 13 หลักผ่านการนับหลักได้หมด */
  it('เลข 13 หลักที่ checksum ผิดถูกปฏิเสธ', () => {
    const valid = withCheckDigit('110170063579');
    const lastDigit = Number(valid[12]);
    const broken = valid.slice(0, 12) + String((lastDigit + 1) % 10);
    expect(broken).toHaveLength(13);
    expect(isValidThaiNationalId(broken)).toBe(false);
  });

  it('ความยาวไม่ใช่ 13 ถูกปฏิเสธ', () => {
    expect(isValidThaiNationalId('123')).toBe(false);
    expect(isValidThaiNationalId(`${withCheckDigit('110170063579')}0`)).toBe(false);
  });

  it('เลขซ้ำทั้งใบถูกปฏิเสธ แม้ checksum จะบังเอิญผ่าน', () => {
    for (let d = 0; d <= 9; d += 1) {
      expect(isValidThaiNationalId(String(d).repeat(13))).toBe(false);
    }
  });

  it('ขีดคั่นแบบที่คนพิมพ์จริงยังอ่านได้', () => {
    const raw = withCheckDigit('110170063579');
    const dashed = `${raw[0]}-${raw.slice(1, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 12)}-${raw[12]}`;
    expect(isValidThaiNationalId(dashed)).toBe(true);
  });
});

describe('อายุ', () => {
  it('นับเป็นปีเต็ม', () => {
    expect(ageOn('2000-08-01', NOW)).toBe(26);
    expect(ageOn('2000-07-31', NOW)).toBe(26);
  });

  /** ยังไม่ถึงวันเกิดปีนี้ = ยังไม่ครบปีนั้น */
  it('วันเกิดยังไม่ถึงในปีนี้ นับน้อยกว่าหนึ่งปี', () => {
    expect(ageOn('2000-08-02', NOW)).toBe(25);
    expect(ageOn('2000-12-31', NOW)).toBe(25);
  });
});

describe('วันหมดอายุ', () => {
  it('เมื่อวานคือหมดอายุ พรุ่งนี้คือยังไม่หมด', () => {
    expect(isExpired('2026-07-31', NOW)).toBe(true);
    expect(isExpired('2026-08-02', NOW)).toBe(false);
  });

  /** หมดอายุ "วันนี้" ยังใช้ได้ทั้งวัน — เอกสารไทยนับทั้งวัน ไม่ตัดตอนเที่ยงคืน UTC */
  it('หมดอายุวันนี้ยังใช้ได้', () => {
    expect(isExpired('2026-08-01', NOW)).toBe(false);
  });
});

describe('ตรวจใบสมัครทั้งใบ', () => {
  const ok = {
    nationalId: withCheckDigit('110170063579'),
    dateOfBirth: '2000-01-15',
    licenceExpiry: '2028-01-01',
    compulsoryInsuranceExpiry: '2027-06-30',
    bankAccountName: 'สมชาย ใจดี',
  };

  it('ใบที่ครบถ้วนผ่านหมด', () => {
    expect(validateRiderApplication(ok, NOW)).toEqual({});
  });

  it(`อายุต่ำกว่า ${MIN_AGE_YEARS} ถูกปฏิเสธ`, () => {
    const errors = validateRiderApplication({ ...ok, dateOfBirth: '2012-01-15' }, NOW);
    expect(errors.dateOfBirth).toBeDefined();
  });

  /**
   * เอกสารหมดอายุต้องถูกบอกตอนส่ง ไม่ใช่ปล่อยผ่านแล้วให้ eligibility.ts เงียบ ๆ ไม่จ่ายงาน
   * ซึ่งไรเดอร์จะไม่มีทางรู้ว่าทำไมไม่มีงานเข้า
   */
  it('ใบขับขี่หรือ พ.ร.บ. หมดอายุถูกปฏิเสธพร้อมบอกช่อง', () => {
    expect(validateRiderApplication({ ...ok, licenceExpiry: '2020-01-01' }, NOW).licenceExpiry)
      .toBeDefined();
    expect(
      validateRiderApplication({ ...ok, compulsoryInsuranceExpiry: '2020-01-01' }, NOW)
        .compulsoryInsuranceExpiry,
    ).toBeDefined();
  });

  it('ผิดหลายช่องคืนมาทุกช่อง ไม่ใช่หยุดที่ช่องแรก', () => {
    const errors = validateRiderApplication(
      { ...ok, nationalId: '1', dateOfBirth: '2015-01-01', licenceExpiry: '2001-01-01' },
      NOW,
    );
    expect(Object.keys(errors).sort()).toEqual(['dateOfBirth', 'licenceExpiry', 'nationalId']);
  });
});

describe('ชื่อบัญชีธนาคารเทียบชื่อตามกฎหมาย (ด่านกันบัญชีม้า §7)', () => {
  it('ตรงกันแม้ต่างที่คำนำหน้าและช่องว่าง', () => {
    expect(bankNameMatchesLegalName('นาย สมชาย ใจดี', 'สมชาย ใจดี')).toBe(true);
    expect(bankNameMatchesLegalName('สมชายใจดี', 'สมชาย ใจดี')).toBe(true);
  });

  it('คนละชื่อคือไม่ตรง', () => {
    expect(bankNameMatchesLegalName('สมหญิง รักดี', 'สมชาย ใจดี')).toBe(false);
  });
});
