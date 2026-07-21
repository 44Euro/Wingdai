import type { Account, Capability, Restaurant } from '../data/types';

/**
 * Navigation อ่านจากผลลัพธ์ของฟังก์ชันนี้ ไม่ใช่จาก accountType ตรง ๆ
 * ตาม claude.md §4 — merchant และ customer เป็น capability ไม่ใช่ account type
 */
export function capabilitiesOf(account: Account, restaurants: Restaurant[]): Capability[] {
  if (account.accountType === 'admin') return ['admin'];

  if (account.accountType === 'rider') {
    // ไรเดอร์ที่ยังไม่ผ่านการอนุมัติเข้าอะไรไม่ได้เลย รวมทั้งการสั่งอาหาร
    if (account.riderApproval !== 'approved') return [];
    return ['rider', 'customer'];
  }

  const caps: Capability[] = ['customer'];
  const hasApprovedShop = restaurants.some(
    (r) => r.ownerUserId === account.id && r.isApproved,
  );
  if (hasApprovedShop) caps.push('merchant');
  return caps;
}
