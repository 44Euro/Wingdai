import type { Account, AccountType, Capability, Restaurant } from '../data/types';

/** §7 ห้ามเทียบ accountType กับ 'admin' ตรง ๆ ที่ไหน คู่แฝดของ `roles.ts` ฝั่งเซิร์ฟเวอร์ */
export function isSuperAdmin(type: AccountType): boolean {
  return type === 'super_admin';
}

/** ซูเปอร์แอดมินนับเป็นแอดมินด้วย เขาต้องทำงานแอดมินประจำวันได้ ไม่ใช่ต้องมีสองบัญชี */
export function isAdmin(type: AccountType): boolean {
  return type === 'admin' || isSuperAdmin(type);
}

/** Navigation อ่านจากผลลัพธ์ของฟังก์ชันนี้ ไม่ใช่จาก accountType ตรง ๆ */
export function capabilitiesOf(account: Account, restaurants: Restaurant[]): Capability[] {
  if (isSuperAdmin(account.accountType)) return ['admin', 'superAdmin'];
  if (isAdmin(account.accountType)) return ['admin'];

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
