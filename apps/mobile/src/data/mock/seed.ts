import type { Account, Restaurant } from '../types';

/** รหัสผ่านของทุกบัญชีทดสอบคือ 1234 */
export const MOCK_PASSWORD = '1234';

export const seedAccounts: Account[] = [
  {
    id: 'u-somchai', accountType: 'user', username: 'somchai',
    fullName: 'สมชาย ใจดี', phone: '0812345678', ownedRestaurantIds: [],
  },
  {
    id: 'u-malee', accountType: 'user', username: 'malee',
    fullName: 'มาลี ศรีสุข', phone: '0823456789', ownedRestaurantIds: ['r-malee'],
  },
  {
    id: 'u-ann', accountType: 'rider', username: 'rider_ann',
    fullName: 'อรอนงค์ ว่องไว', phone: '0834567890',
    riderApproval: 'approved', ownedRestaurantIds: [],
  },
  {
    id: 'u-new', accountType: 'rider', username: 'rider_new',
    fullName: 'ณัฐพล เพิ่งสมัคร', phone: '0845678901',
    riderApproval: 'pending', ownedRestaurantIds: [],
  },
  {
    id: 'u-admin', accountType: 'admin', username: 'admin_root',
    fullName: 'ผู้ดูแลระบบ', phone: '0856789012', ownedRestaurantIds: [],
  },
];

export const seedRestaurants: Restaurant[] = [
  { id: 'r-malee', ownerUserId: 'u-malee', name: 'ครัวมาลี', isApproved: true, isOpen: true },
  { id: 'r-somtam', ownerUserId: 'u-other', name: 'ส้มตำแซ่บนัว', isApproved: true, isOpen: true },
  { id: 'r-closed', ownerUserId: 'u-other', name: 'ก๋วยเตี๋ยวเรือ', isApproved: true, isOpen: false },
  { id: 'r-pending', ownerUserId: 'u-somchai', name: 'ร้านรออนุมัติ', isApproved: false, isOpen: false },
];
