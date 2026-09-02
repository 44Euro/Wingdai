import { describe, it, expect } from 'vitest';
import { assertGrantable } from './adminRoles.service';

/**
 * จอให้สิทธิ์เคยเป็นประตูทางเดียว — ลิสต์เฉพาะคนที่เป็นแอดมินอยู่แล้ว
 * พอถอนสิทธิ์คนสุดท้ายออก บัญชีนั้นก็หายจากลิสต์และไม่มีทางให้กลับคืน
 * (เกิดขึ้นจริงกับ admin_root บนฐานสาธิต)
 */
describe('ให้สิทธิ์ผู้ดูแลระบบกับบัญชีที่ยังไม่ใช่แอดมิน', () => {
  it('บัญชีลูกค้าธรรมดายกขึ้นเป็นแอดมินได้', () => {
    expect(() => assertGrantable({ role: 'user', isSelf: false })).not.toThrow();
  });

  it('บัญชีไรเดอร์ยกไม่ได้ ตาราง rider_profiles มีทริกเกอร์บังคับไว้', () => {
    expect(() => assertGrantable({ role: 'rider', isSelf: false })).toThrow(/ไรเดอร์/);
  });

  it('ยกให้ตัวเองไม่ได้ ต้องให้ซูเปอร์แอดมินคนอื่นเป็นคนทำ', () => {
    expect(() => assertGrantable({ role: 'user', isSelf: true })).toThrow(/ตัวเอง/);
  });

  it('คนที่เป็นแอดมินอยู่แล้วยกซ้ำได้ ไม่ต้องกันไว้ เป็น no-op ที่ปลอดภัย', () => {
    expect(() => assertGrantable({ role: 'admin', isSelf: false })).not.toThrow();
  });
});
