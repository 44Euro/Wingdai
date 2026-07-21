import type { Account, Capability, Restaurant } from '../data/types';

/** Navigation อ่านจากผลลัพธ์ของฟังก์ชันนี้ ไม่ใช่จาก accountType ตรง ๆ */
export function capabilitiesOf(account: Account, restaurants: Restaurant[]): Capability[] {
  /** ซูเปอร์แอดมินได้ สองอย่าง ไม่ใช่อย่างเดียว เขาต้องทำงานแอดมินประจำวันได้ด้วย */
  if (account.accountType === 'super_admin') return ['admin', 'superAdmin'];
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
