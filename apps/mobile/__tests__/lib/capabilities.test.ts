import { capabilitiesOf } from '../../src/lib/capabilities';
import type { Account, Restaurant } from '../../src/data/types';

const base: Account = {
  id: 'u1',
  accountType: 'user',
  username: 'somchai',
  fullName: 'สมชาย ใจดี',
  phone: '0812345678',
  ownedRestaurantIds: [],
};

const approvedShop: Restaurant = {
  id: 'r1', ownerUserId: 'u1', name: 'ร้านทดสอบ', isApproved: true, isOpen: true,
  cuisine: 'rice', distanceKm: 1, prepTimeMinutes: 10, rating: 4.5, opensAt: null,
};
const pendingShop: Restaurant = { ...approvedShop, id: 'r2', isApproved: false };

describe('capabilitiesOf', () => {
  it('บัญชี user ธรรมดาได้ customer อย่างเดียว', () => {
    expect(capabilitiesOf(base, [])).toEqual(['customer']);
  });

  it('user ที่มีร้านอนุมัติแล้วได้ customer + merchant', () => {
    const acc = { ...base, ownedRestaurantIds: ['r1'] };
    expect(capabilitiesOf(acc, [approvedShop]).sort()).toEqual(['customer', 'merchant']);
  });

  it('user ที่มีร้านรออนุมัติยังไม่ได้ merchant', () => {
    const acc = { ...base, ownedRestaurantIds: ['r2'] };
    expect(capabilitiesOf(acc, [pendingShop])).toEqual(['customer']);
  });

  it('rider ที่อนุมัติแล้วได้ rider + customer', () => {
    const acc: Account = { ...base, accountType: 'rider', riderApproval: 'approved' };
    expect(capabilitiesOf(acc, []).sort()).toEqual(['customer', 'rider']);
  });

  it('rider ที่รออนุมัติไม่ได้ capability ใดเลย รวมทั้งการสั่งอาหาร', () => {
    const acc: Account = { ...base, accountType: 'rider', riderApproval: 'pending' };
    expect(capabilitiesOf(acc, [])).toEqual([]);
  });

  it('rider ที่ถูกปฏิเสธไม่ได้ capability ใดเลย', () => {
    const acc: Account = { ...base, accountType: 'rider', riderApproval: 'rejected' };
    expect(capabilitiesOf(acc, [])).toEqual([]);
  });

  it('admin ได้ admin อย่างเดียว ไม่ได้ customer', () => {
    const acc: Account = { ...base, accountType: 'admin' };
    expect(capabilitiesOf(acc, [])).toEqual(['admin']);
  });

  /** ซูเปอร์แอดมินต้องทำงานแอดมินได้ด้วย ไม่ใช่ได้แต่จอตั้งค่า */
  it('super_admin ได้ทั้ง admin และ superAdmin', () => {
    const acc: Account = { ...base, accountType: 'super_admin' };
    expect(capabilitiesOf(acc, [])).toEqual(['admin', 'superAdmin']);
  });

  it('super_admin ไม่ได้ customer — เป็นบัญชีทำงาน ไม่ใช่บัญชีสั่งอาหาร', () => {
    const acc: Account = { ...base, accountType: 'super_admin' };
    expect(capabilitiesOf(acc, [])).not.toContain('customer');
  });

  it('ร้านของคนอื่นไม่ทำให้ได้ merchant', () => {
    const other: Restaurant = { ...approvedShop, id: 'r9', ownerUserId: 'u2' };
    expect(capabilitiesOf(base, [other])).toEqual(['customer']);
  });
});
