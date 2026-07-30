import type { Account, Restaurant, MenuItem, Address } from '../types';

/** รหัสผ่านของทุกบัญชีทดสอบคือ 1234 */
export const MOCK_PASSWORD = '1234';

export const seedAccounts: Account[] = [
  {
    id: 'u-somchai', accountType: 'user', username: 'somchai',
    fullName: 'สมชาย ใจดี', phone: '0812345678', email: 'somchai@wingdai.test',
    ownedRestaurantIds: [],
  },
  {
    id: 'u-malee', accountType: 'user', username: 'malee',
    fullName: 'มาลี ศรีสุข', phone: '0823456789', email: 'malee@wingdai.test',
    ownedRestaurantIds: ['r-malee'],
  },
  {
    id: 'u-ann', accountType: 'rider', username: 'rider_ann',
    fullName: 'อรอนงค์ ว่องไว', phone: '0834567890', email: 'rider_ann@wingdai.test',
    riderApproval: 'approved', ownedRestaurantIds: [],
  },
  {
    id: 'u-new', accountType: 'rider', username: 'rider_new',
    fullName: 'ณัฐพล เพิ่งสมัคร', phone: '0845678901', email: 'rider_new@wingdai.test',
    riderApproval: 'pending', ownedRestaurantIds: [],
  },
  {
    id: 'u-admin', accountType: 'admin', username: 'admin_root',
    fullName: 'ผู้ดูแลระบบ', phone: '0856789012', email: 'admin_root@wingdai.test',
    ownedRestaurantIds: [],
  },
];

export const seedRestaurants: Restaurant[] = [
  { id: 'r-malee', ownerUserId: 'u-malee', name: 'ครัวมาลี', isApproved: true, isOpen: true, cuisine: 'rice', distanceKm: 0.6, prepTimeMinutes: 12, rating: 4.8 },
  { id: 'r-somtam', ownerUserId: 'u-other', name: 'ส้มตำแซ่บนัว', isApproved: true, isOpen: true, cuisine: 'somtam', distanceKm: 1.1, prepTimeMinutes: 10, rating: 4.9 },
  { id: 'r-closed', ownerUserId: 'u-other', name: 'ก๋วยเตี๋ยวเรือ', isApproved: true, isOpen: false, cuisine: 'noodle', distanceKm: 0.9, prepTimeMinutes: 8, rating: 4.6 },
  { id: 'r-pending', ownerUserId: 'u-somchai', name: 'ร้านรออนุมัติ', isApproved: false, isOpen: false, cuisine: 'rice', distanceKm: 1.4, prepTimeMinutes: 15, rating: 4.5 },
];

export const seedMenuItems: MenuItem[] = [
  // ครัวมาลี (rice)
  {
    id: 'm-malee-1', restaurantId: 'r-malee', name: 'ข้าวกะเพราหมูสับ', description: 'ไข่ดาวกรอบ', price: 5000, category: 'rice', isAvailable: true,
    optionGroups: [
      {
        id: 'g-spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1,
        choices: [
          { id: 'c-spicy-low', name: 'เผ็ดน้อย', priceDelta: 0 },
          { id: 'c-spicy-mid', name: 'เผ็ดกลาง', priceDelta: 0 },
          { id: 'c-spicy-high', name: 'เผ็ดมาก', priceDelta: 0 },
        ],
      },
      {
        id: 'g-topping', name: 'ท็อปปิ้ง', minSelect: 0, maxSelect: 2,
        choices: [
          { id: 'c-egg', name: 'ไข่ดาว', priceDelta: 1500 },
          { id: 'c-sausage', name: 'กุนเชียง', priceDelta: 1500 },
        ],
      },
    ],
  },
  {
    id: 'm-malee-2', restaurantId: 'r-malee', name: 'ข้าวผัดกุ้ง', price: 6000, category: 'rice', isAvailable: true,
    optionGroups: [
      { id: 'g-m2-spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-m2-mild', name: 'ไม่เผ็ด', priceDelta: 0 },
        { id: 'c-m2-hot', name: 'เผ็ด', priceDelta: 0 },
      ] },
      { id: 'g-m2-extra', name: 'เพิ่มพิเศษ', minSelect: 0, maxSelect: 2, choices: [
        { id: 'c-m2-shrimp', name: 'เพิ่มกุ้ง', priceDelta: 3000 },
        { id: 'c-m2-egg', name: 'ไข่ดาว', priceDelta: 1500 },
      ] },
    ],
  },
  {
    id: 'm-malee-3', restaurantId: 'r-malee', name: 'ข้าวมันไก่', price: 4500, category: 'rice', isAvailable: true,
    optionGroups: [
      { id: 'g-m3-part', name: 'ส่วนของไก่', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-m3-thigh', name: 'สะโพก', priceDelta: 0 },
        { id: 'c-m3-breast', name: 'อก', priceDelta: 0 },
      ] },
    ],
  },
  { id: 'm-malee-4', restaurantId: 'r-malee', name: 'ชาไทยเย็น', price: 2500, category: 'drink', isAvailable: true },
  { id: 'm-malee-5', restaurantId: 'r-malee', name: 'ข้าวหมูทอด', price: 5000, category: 'rice', isAvailable: false },
  // ส้มตำแซ่บนัว (somtam)
  {
    id: 'm-somtam-1', restaurantId: 'r-somtam', name: 'ส้มตำไทย', price: 4000, category: 'somtam', isAvailable: true,
    optionGroups: [
      { id: 'g-st1-spicy', name: 'ระดับเผ็ด', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-st1-1', name: 'เผ็ดน้อย', priceDelta: 0 },
        { id: 'c-st1-2', name: 'เผ็ดกลาง', priceDelta: 0 },
        { id: 'c-st1-3', name: 'เผ็ดมาก', priceDelta: 0 },
      ] },
      { id: 'g-st1-add', name: 'เพิ่มเติม', minSelect: 0, maxSelect: 2, choices: [
        { id: 'c-st1-shrimp', name: 'กุ้งสด', priceDelta: 2000 },
        { id: 'c-st1-crab', name: 'ปูเค็ม', priceDelta: 1500 },
      ] },
    ],
  },
  {
    id: 'm-somtam-2', restaurantId: 'r-somtam', name: 'ไก่ย่าง', price: 6500, category: 'somtam', isAvailable: true,
    optionGroups: [
      { id: 'g-st2-part', name: 'ส่วน', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-st2-leg', name: 'น่อง', priceDelta: 0 },
        { id: 'c-st2-breast', name: 'อก', priceDelta: 0 },
        { id: 'c-st2-thigh', name: 'สะโพก', priceDelta: 0 },
      ] },
    ],
  },
  { id: 'm-somtam-3', restaurantId: 'r-somtam', name: 'ข้าวเหนียว', price: 1000, category: 'rice', isAvailable: true },
  { id: 'm-somtam-4', restaurantId: 'r-somtam', name: 'น้ำมะพร้าว', price: 3000, category: 'drink', isAvailable: true },
  // ก๋วยเตี๋ยวเรือ (noodle, ร้านปิด — มีเมนูไว้ทดสอบสถานะปิด)
  {
    id: 'm-closed-1', restaurantId: 'r-closed', name: 'ก๋วยเตี๋ยวเรือหมู', price: 5000, category: 'noodle', isAvailable: true,
    optionGroups: [
      { id: 'g-cl1-noodle', name: 'เส้น', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-cl1-small', name: 'เส้นเล็ก', priceDelta: 0 },
        { id: 'c-cl1-big', name: 'เส้นใหญ่', priceDelta: 0 },
        { id: 'c-cl1-mama', name: 'บะหมี่', priceDelta: 0 },
      ] },
      { id: 'g-cl1-extra', name: 'พิเศษ', minSelect: 0, maxSelect: 1, choices: [
        { id: 'c-cl1-meat', name: 'เพิ่มเนื้อ', priceDelta: 1500 },
      ] },
    ],
  },
  { id: 'm-closed-2', restaurantId: 'r-closed', name: 'เกาเหลา', price: 5500, category: 'noodle', isAvailable: true },
];

/**
 * ที่อยู่จัดส่ง — ผูกกับบัญชี เพราะเป็นข้อมูลส่วนตัว
 * สมชายมีที่อยู่ไว้ให้สั่งอาหารได้เลย ส่วนบัญชีที่สมัครใหม่ต้องเพิ่มเองก่อนสั่ง (เหมือนของจริง)
 */
export const seedAddresses: (Address & { accountId: string })[] = [
  {
    id: 'addr-somchai-home', accountId: 'u-somchai', label: 'บ้าน',
    addressText: 'ซอยอารีย์ 3 คอนโดอารีย์เพลส ห้อง 502', note: 'ฝากไว้ที่นิติได้',
    lat: 13.7815, lng: 100.5450,
  },
  {
    id: 'addr-somchai-work', accountId: 'u-somchai', label: 'ที่ทำงาน',
    addressText: 'อาคารพหลโยธินเพลส ชั้น 12',
    lat: 13.7789, lng: 100.5395,
  },
];
