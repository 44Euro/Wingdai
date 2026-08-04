import type { accountType } from '../db/schema/enums';

export type AccountType = (typeof accountType.enumValues)[number];

/** ใครนับเป็น "ผู้ดูแลระบบ" (product-spec §7) */
export function isAdmin(type: AccountType): boolean {
  return type === 'admin' || type === 'super_admin';
}

/** เฉพาะซูเปอร์แอดมิน ตั้งค่าที่กระทบทั้งแพลตฟอร์ม (ราคา flag บทบาท) */
export function isSuperAdmin(type: AccountType): boolean {
  return type === 'super_admin';
}
