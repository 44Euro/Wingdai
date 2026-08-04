import { describe, it, expect } from 'vitest';
import { isAdmin, isSuperAdmin, type AccountType } from './roles';

const ALL: AccountType[] = ['user', 'rider', 'admin', 'super_admin'];

describe('isAdmin', () => {
  /** ข้อที่พลาดง่ายที่สุดตอนเพิ่มบทบาท: ลืมว่าซูเปอร์แอดมินต้องทำงานแอดมินได้ด้วย */
  it('ซูเปอร์แอดมินนับเป็นแอดมินด้วย', () => {
    expect(isAdmin('super_admin')).toBe(true);
    expect(isAdmin('admin')).toBe(true);
  });

  it('ลูกค้ากับไรเดอร์ไม่ใช่แอดมิน', () => {
    expect(isAdmin('user')).toBe(false);
    expect(isAdmin('rider')).toBe(false);
  });

  it('ครอบทุกค่าใน enum — เพิ่มค่าใหม่แล้วต้องกลับมาตัดสินใจที่นี่', () => {
    expect(ALL.filter(isAdmin).sort()).toEqual(['admin', 'super_admin']);
  });
});

describe('isSuperAdmin', () => {
  /** แอดมินธรรมดาต้องแก้ราคาและ feature flag ไม่ได้ นั่นคือทั้งหมดที่บทบาทนี้กั้น */
  it('มีคนเดียวที่ผ่าน', () => {
    expect(ALL.filter(isSuperAdmin)).toEqual(['super_admin']);
  });
});
