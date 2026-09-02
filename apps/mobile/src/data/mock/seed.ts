import type { Account, Restaurant, MenuItem, Address } from '../types';
import { photoFor } from './photos';

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
  /** ซูเปอร์แอดมิน ต้องมีแยกจาก `admin_root` ไม่ใช่อัปเกรดบัญชีเดิม */
  {
    id: 'u-super', accountType: 'super_admin', username: 'super_root',
    fullName: 'ผู้ดูแลระบบระดับสูง', phone: '0867890124', email: 'super_root@wingdai.test',
    ownedRestaurantIds: [],
  },
];

/** `rating` เป็น null ทุกร้านโดยตั้งใจ ยังไม่มีระบบรีวิวจนถึงคลื่นที่ 3 */
export const seedRestaurants: Restaurant[] = [
  { id: 'r-malee', ownerUserId: 'u-malee', name: 'ครัวมาลี', nameEn: 'Malee Kitchen', isApproved: true, isOpen: true, cuisine: 'rice', distanceKm: 0.6, prepTimeMinutes: 12, rating: null, opensAt: null, photoUrl: photoFor('ครัวมาลี') },
  { id: 'r-somtam', ownerUserId: 'u-other', name: 'ส้มตำแซ่บนัว', nameEn: 'Saep Nua Som Tam', isApproved: true, isOpen: true, cuisine: 'somtam', distanceKm: 1.1, prepTimeMinutes: 10, rating: null, opensAt: null, photoUrl: photoFor('ส้มตำแซ่บนัว') },
  { id: 'r-closed', ownerUserId: 'u-other', name: 'ก๋วยเตี๋ยวเรือ', nameEn: 'Boat Noodles', isApproved: true, isOpen: false, cuisine: 'noodle', distanceKm: 0.9, prepTimeMinutes: 8, rating: null, opensAt: null, photoUrl: photoFor('ก๋วยเตี๋ยวเรือ') },
  { id: 'r-pending', ownerUserId: 'u-somchai', name: 'ร้านรออนุมัติ', nameEn: 'Pending Approval Shop', isApproved: false, isOpen: false, cuisine: 'rice', distanceKm: 1.4, prepTimeMinutes: 15, rating: null, opensAt: null, photoUrl: photoFor('ร้านรออนุมัติ') },
];

/** พิกัดร้าน ของจริงอยู่ที่คอลัมน์ `restaurants.location` (PostGIS) */
export const seedRestaurantCoords: Record<string, { lat: number; lng: number }> = {
  'r-malee': { lat: 13.7761, lng: 100.545 },
  'r-somtam': { lat: 13.7815, lng: 100.55519 },
  'r-closed': { lat: 13.78959, lng: 100.545 },
  'r-pending': { lat: 13.7815, lng: 100.53204 },
};

/** ── ร้านชุดสาธิต ──────────────────────────────────────────────────────────── */
const HOME = { lat: 13.7815, lng: 100.545 }; // บ้านของ somchai — ที่อยู่ตั้งต้น
const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = 108.12; // ที่ละติจูด ~13.8° องศาลองจิจูดสั้นลงตาม cos(lat)

function coordAt(km: number, bearingDeg: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    lat: Number((HOME.lat + (km * Math.cos(rad)) / KM_PER_DEG_LAT).toFixed(5)),
    lng: Number((HOME.lng + (km * Math.sin(rad)) / KM_PER_DEG_LNG).toFixed(5)),
  };
}

type DemoShop = {
  key: string;
  name: string; nameEn: string;
  cuisine: MenuItem['category'];
  km: number;
  bearing: number;
  prep: number;
  closed?: boolean;
};

/** ในรัศมี 5 กม. ลูกค้าเห็นและสั่งได้ ความหนาแน่นแบบนี้คือตัวธุรกิจตาม product-spec §1 */
const NEARBY: DemoShop[] = [
  { key: 'khaomunkai', name: 'ข้าวมันไก่ประตูน้ำ', nameEn: 'Pratunam Chicken Rice', cuisine: 'rice', km: 0.4, bearing: 20, prep: 10 },
  { key: 'boatnoodle', name: 'ก๋วยเตี๋ยวเนื้อตุ๋นอารีย์', nameEn: 'Ari Braised Beef Noodles', cuisine: 'noodle', km: 0.7, bearing: 75, prep: 9 },
  { key: 'tammua', name: 'ตำมั่วสาขาอารีย์', nameEn: 'Tam Mua Ari', cuisine: 'somtam', km: 0.8, bearing: 140, prep: 11 },
  { key: 'boba', name: 'ชานมไข่มุกอารีย์', nameEn: 'Ari Bubble Tea', cuisine: 'drink', km: 0.5, bearing: 210, prep: 6 },
  { key: 'bingsu', name: 'บิงซูหวานเย็น', nameEn: 'Sweet Ice Bingsu', cuisine: 'dessert', km: 1.0, bearing: 265, prep: 8 },
  { key: 'moodaeng', name: 'ข้าวหมูแดงเจ๊หมวย', nameEn: 'Jay Muay Red Pork Rice', cuisine: 'rice', km: 1.2, bearing: 310, prep: 12 },
  { key: 'bamee', name: 'บะหมี่เกี๊ยวกุ้งสะพานควาย', nameEn: 'Saphan Khwai Shrimp Wonton Noodles', cuisine: 'noodle', km: 1.5, bearing: 45, prep: 10 },
  { key: 'somtamnua', name: 'ส้มตำนัวนัว', nameEn: 'Som Tam Nua Nua', cuisine: 'somtam', km: 1.8, bearing: 120, prep: 13 },
  { key: 'coffee', name: 'กาแฟสดอารีย์โรสต์', nameEn: 'Ari Roast Coffee', cuisine: 'drink', km: 0.9, bearing: 340, prep: 5 },
  { key: 'roti', name: 'โรตีชาชักพหลโยธิน', nameEn: 'Phahonyothin Roti & Cha Chak', cuisine: 'dessert', km: 1.6, bearing: 190, prep: 7 },
  { key: 'khamoo', name: 'ข้าวขาหมูตรอกซุง', nameEn: 'Trok Sung Pork Leg Rice', cuisine: 'rice', km: 2.1, bearing: 95, prep: 11 },
  { key: 'tomyum', name: 'ก๋วยเตี๋ยวต้มยำเจ๊นิด', nameEn: 'Jay Nid Tom Yum Noodles', cuisine: 'noodle', km: 2.4, bearing: 240, prep: 12 },
  { key: 'kaengpa', name: 'ข้าวแกงป้าอ้วน', nameEn: 'Pa Uan Curry Rice', cuisine: 'rice', km: 2.8, bearing: 15, prep: 9, closed: true },
  { key: 'nampan', name: 'น้ำปั่นเจ๊แดง', nameEn: 'Jay Daeng Fruit Smoothies', cuisine: 'drink', km: 3.2, bearing: 160, prep: 6 },
  { key: 'kanomkrok', name: 'ขนมครกโบราณ', nameEn: 'Old-Style Kanom Krok', cuisine: 'dessert', km: 3.6, bearing: 285, prep: 10 },
  { key: 'pnual', name: 'ส้มตำป้านวล', nameEn: 'Pa Nuan Som Tam', cuisine: 'somtam', km: 4.2, bearing: 60, prep: 14 },
];

/** นอกรัศมี 5 กม. ตั้งใจให้อยู่นอก */
const FAR: DemoShop[] = [
  { key: 'silom', name: 'ข้าวต้มสีลม', nameEn: 'Silom Rice Porridge', cuisine: 'rice', km: 7.5, bearing: 185, prep: 12 },
  { key: 'thonglor', name: 'ราเมนทองหล่อ', nameEn: 'Thonglor Ramen', cuisine: 'noodle', km: 8.4, bearing: 130, prep: 15 },
  { key: 'bangna', name: 'ส้มตำบางนา', nameEn: 'Bangna Som Tam', cuisine: 'somtam', km: 14.2, bearing: 150, prep: 12 },
];

export const demoShops: (DemoShop & { id: string; lat: number; lng: number })[] =
  [...NEARBY, ...FAR].map((s) => ({
    ...s,
    id: `r-${s.key}`,
    ...coordAt(s.km, s.bearing),
  }));

for (const s of demoShops) {
  seedRestaurants.push({
    id: s.id,
    ownerUserId: 'u-other',
    name: s.name,
    nameEn: s.nameEn,
    isApproved: true,
    isOpen: !s.closed,
    cuisine: s.cuisine,
    distanceKm: s.km,
    prepTimeMinutes: s.prep,
    // คิดตอนอ่านจากตารางเวลาเสมอ (mock/index.ts → withOpenState) ค่าที่เก็บไว้จึงเป็น null
    opensAt: null,
    rating: null,
    photoUrl: photoFor(s.name),
  });
  seedRestaurantCoords[s.id] = { lat: s.lat, lng: s.lng };
}

/** เมนูของร้านชุดสาธิต สร้างจากแม่แบบต่อหมวด ไม่ได้พิมพ์ทีละจาน */
const MENU_TEMPLATE: Record<MenuItem['category'], { name: string; nameEn: string; price: number }[]> = {
  rice: [
    { name: 'ข้าวกะเพราหมู', nameEn: 'Pork Basil Rice', price: 5000 },
    { name: 'ข้าวผัดหมู', nameEn: 'Pork Fried Rice', price: 5500 },
    { name: 'ข้าวไข่เจียว', nameEn: 'Thai Omelette Rice', price: 4000 },
  ],
  noodle: [
    { name: 'ก๋วยเตี๋ยวหมูน้ำใส', nameEn: 'Clear Pork Noodle Soup', price: 5000 },
    { name: 'บะหมี่แห้ง', nameEn: 'Dry Egg Noodles', price: 5500 },
    { name: 'เกาเหลารวมมิตร', nameEn: 'Mixed Soup, No Noodles', price: 6500 },
  ],
  somtam: [
    { name: 'ส้มตำไทย', nameEn: 'Thai Papaya Salad', price: 4000 },
    { name: 'ไก่ย่าง', nameEn: 'Grilled Chicken', price: 6500 },
    { name: 'ข้าวเหนียว', nameEn: 'Sticky Rice', price: 1000 },
  ],
  drink: [
    { name: 'ชาไทยเย็น', nameEn: 'Thai Iced Tea', price: 2500 },
    { name: 'อเมริกาโน่เย็น', nameEn: 'Iced Americano', price: 5500 },
    { name: 'น้ำส้มคั้นสด', nameEn: 'Fresh Orange Juice', price: 4500 },
  ],
  dessert: [
    { name: 'บัวลอยไข่หวาน', nameEn: 'Bua Loy with Sweet Egg', price: 4000 },
    { name: 'ไอศกรีมกะทิ', nameEn: 'Coconut Ice Cream', price: 3500 },
    { name: 'ขนมครก', nameEn: 'Kanom Krok', price: 3000 },
  ],
};

export const seedMenuItems: MenuItem[] = [
  // ครัวมาลี (rice)
  {
    id: 'm-malee-1', restaurantId: 'r-malee', name: 'ข้าวกะเพราหมูสับ', nameEn: 'Minced Pork Basil Rice', description: 'ไข่ดาวกรอบ', price: 5000, category: 'rice', photoUrl: photoFor('ข้าวกะเพราหมูสับ'), isAvailable: true,
    optionGroups: [
      {
        id: 'g-spicy', name: 'ระดับเผ็ด', nameEn: 'Spice level', minSelect: 1, maxSelect: 1,
        choices: [
          { id: 'c-spicy-low', name: 'เผ็ดน้อย', nameEn: 'Mild', priceDelta: 0 },
          { id: 'c-spicy-mid', name: 'เผ็ดกลาง', nameEn: 'Medium', priceDelta: 0 },
          { id: 'c-spicy-high', name: 'เผ็ดมาก', nameEn: 'Extra spicy', priceDelta: 0 },
        ],
      },
      {
        id: 'g-topping', name: 'ท็อปปิ้ง', nameEn: 'Toppings', minSelect: 0, maxSelect: 2,
        choices: [
          { id: 'c-egg', name: 'ไข่ดาว', nameEn: 'Fried egg', priceDelta: 1500 },
          { id: 'c-sausage', name: 'กุนเชียง', nameEn: 'Chinese sausage', priceDelta: 1500 },
        ],
      },
    ],
  },
  {
    id: 'm-malee-2', restaurantId: 'r-malee', name: 'ข้าวผัดกุ้ง', nameEn: 'Shrimp Fried Rice', price: 6000, category: 'rice', photoUrl: photoFor('ข้าวผัดกุ้ง'), isAvailable: true,
    optionGroups: [
      { id: 'g-m2-spicy', name: 'ระดับเผ็ด', nameEn: 'Spice level', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-m2-mild', name: 'ไม่เผ็ด', nameEn: 'Not spicy', priceDelta: 0 },
        { id: 'c-m2-hot', name: 'เผ็ด', nameEn: 'Spicy', priceDelta: 0 },
      ] },
      { id: 'g-m2-extra', name: 'เพิ่มพิเศษ', nameEn: 'Add-ons', minSelect: 0, maxSelect: 2, choices: [
        { id: 'c-m2-shrimp', name: 'เพิ่มกุ้ง', nameEn: 'Extra shrimp', priceDelta: 3000 },
        { id: 'c-m2-egg', name: 'ไข่ดาว', nameEn: 'Fried egg', priceDelta: 1500 },
      ] },
    ],
  },
  {
    id: 'm-malee-3', restaurantId: 'r-malee', name: 'ข้าวมันไก่', nameEn: 'Chicken Rice', price: 4500, category: 'rice', photoUrl: photoFor('ข้าวมันไก่'), isAvailable: true,
    optionGroups: [
      { id: 'g-m3-part', name: 'ส่วนของไก่', nameEn: 'Chicken cut', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-m3-thigh', name: 'สะโพก', nameEn: 'Thigh', priceDelta: 0 },
        { id: 'c-m3-breast', name: 'อก', nameEn: 'Breast', priceDelta: 0 },
      ] },
    ],
  },
  { id: 'm-malee-4', restaurantId: 'r-malee', name: 'ชาไทยเย็น', nameEn: 'Thai Iced Tea', price: 2500, category: 'drink', photoUrl: photoFor('ชาไทยเย็น'), isAvailable: true },
  { id: 'm-malee-5', restaurantId: 'r-malee', name: 'ข้าวหมูทอด', nameEn: 'Fried Pork Rice', price: 5000, category: 'rice', photoUrl: photoFor('ข้าวหมูทอด'), isAvailable: false },
  // ส้มตำแซ่บนัว (somtam)
  {
    id: 'm-somtam-1', restaurantId: 'r-somtam', name: 'ส้มตำไทย', nameEn: 'Thai Papaya Salad', price: 4000, category: 'somtam', photoUrl: photoFor('ส้มตำไทย'), isAvailable: true,
    optionGroups: [
      { id: 'g-st1-spicy', name: 'ระดับเผ็ด', nameEn: 'Spice level', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-st1-1', name: 'เผ็ดน้อย', nameEn: 'Mild', priceDelta: 0 },
        { id: 'c-st1-2', name: 'เผ็ดกลาง', nameEn: 'Medium', priceDelta: 0 },
        { id: 'c-st1-3', name: 'เผ็ดมาก', nameEn: 'Extra spicy', priceDelta: 0 },
      ] },
      { id: 'g-st1-add', name: 'เพิ่มเติม', nameEn: 'Extras', minSelect: 0, maxSelect: 2, choices: [
        { id: 'c-st1-shrimp', name: 'กุ้งสด', nameEn: 'Fresh shrimp', priceDelta: 2000 },
        { id: 'c-st1-crab', name: 'ปูเค็ม', nameEn: 'Salted crab', priceDelta: 1500 },
      ] },
    ],
  },
  {
    id: 'm-somtam-2', restaurantId: 'r-somtam', name: 'ไก่ย่าง', nameEn: 'Grilled Chicken', price: 6500, category: 'somtam', photoUrl: photoFor('ไก่ย่าง'), isAvailable: true,
    optionGroups: [
      { id: 'g-st2-part', name: 'ส่วน', nameEn: 'Cut', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-st2-leg', name: 'น่อง', nameEn: 'Drumstick', priceDelta: 0 },
        { id: 'c-st2-breast', name: 'อก', nameEn: 'Breast', priceDelta: 0 },
        { id: 'c-st2-thigh', name: 'สะโพก', nameEn: 'Thigh', priceDelta: 0 },
      ] },
    ],
  },
  { id: 'm-somtam-3', restaurantId: 'r-somtam', name: 'ข้าวเหนียว', nameEn: 'Sticky Rice', price: 1000, category: 'rice', photoUrl: photoFor('ข้าวเหนียว'), isAvailable: true },
  { id: 'm-somtam-4', restaurantId: 'r-somtam', name: 'น้ำมะพร้าว', nameEn: 'Coconut Water', price: 3000, category: 'drink', photoUrl: photoFor('น้ำมะพร้าว'), isAvailable: true },
  // ก๋วยเตี๋ยวเรือ (noodle, ร้านปิด มีเมนูไว้ทดสอบสถานะปิด)
  {
    id: 'm-closed-1', restaurantId: 'r-closed', name: 'ก๋วยเตี๋ยวเรือหมู', nameEn: 'Pork Boat Noodles', price: 5000, category: 'noodle', photoUrl: photoFor('ก๋วยเตี๋ยวเรือหมู'), isAvailable: true,
    optionGroups: [
      { id: 'g-cl1-noodle', name: 'เส้น', nameEn: 'Noodle type', minSelect: 1, maxSelect: 1, choices: [
        { id: 'c-cl1-small', name: 'เส้นเล็ก', nameEn: 'Thin rice noodles', priceDelta: 0 },
        { id: 'c-cl1-big', name: 'เส้นใหญ่', nameEn: 'Wide rice noodles', priceDelta: 0 },
        { id: 'c-cl1-mama', name: 'บะหมี่', nameEn: 'Egg noodles', priceDelta: 0 },
      ] },
      { id: 'g-cl1-extra', name: 'พิเศษ', nameEn: 'Extras', minSelect: 0, maxSelect: 1, choices: [
        { id: 'c-cl1-meat', name: 'เพิ่มเนื้อ', nameEn: 'Extra beef', priceDelta: 1500 },
      ] },
    ],
  },
  { id: 'm-closed-2', restaurantId: 'r-closed', name: 'เกาเหลา', nameEn: 'Soup Without Noodles', price: 5500, category: 'noodle', photoUrl: photoFor('เกาเหลา'), isAvailable: true },
];

/** ที่อยู่จัดส่ง ผูกกับบัญชี เพราะเป็นข้อมูลส่วนตัว */
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

/** เติมเมนูของร้านชุดสาธิต อยู่ท้ายไฟล์เพราะ `seedMenuItems` เพิ่งประกาศข้างบน */
for (const s of demoShops) {
  const template = MENU_TEMPLATE[s.cuisine];
  template.forEach((item, i) => {
    seedMenuItems.push({
      id: `m-${s.key}-${i + 1}`,
      restaurantId: s.id,
      name: item.name,
      nameEn: item.nameEn,
      price: item.price,
      category: s.cuisine,
      photoUrl: photoFor(item.name),
      // จานสุดท้ายของทุกร้านหมด เพื่อให้ป้าย "วันนี้หมดแล้ว" มีของให้เห็นทุกร้าน
      isAvailable: i < template.length - 1,
    });
  });
}
