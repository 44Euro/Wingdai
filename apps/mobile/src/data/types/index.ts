export type AccountType = 'user' | 'rider' | 'admin';
export type Capability = 'customer' | 'merchant' | 'rider' | 'admin';
export type RiderApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Account {
  id: string;
  accountType: AccountType;
  username: string;
  fullName: string;
  phone: string;
  /** login alias เสริม — ไม่ผ่าน OTP verify, phone ยังเป็น verified channel เดียว ตาม claude.md §4.2 */
  email?: string;
  /** มีค่าเฉพาะเมื่อ accountType === 'rider' */
  riderApproval?: RiderApprovalStatus;
  ownedRestaurantIds: string[];
}

export type CuisineCategory = 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert';

export interface Restaurant {
  id: string;
  ownerUserId: string;
  name: string;
  isApproved: boolean;
  isOpen: boolean;
  cuisine: CuisineCategory;
  /** mock ระยะทางจากผู้ใช้ (กม.) — density ตาม claude.md §1 */
  distanceKm: number;
  /** ค่าคงที่ที่ร้านตั้งเอง — seed cold-start ให้ dispatch (§6.3) */
  prepTimeMinutes: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  /** สตางค์ (claude.md §7) */
  price: number;
  category: CuisineCategory;
  isAvailable: boolean;
}

export type OrderStatus =
  | 'created' | 'accepted' | 'preparing' | 'picked_up' | 'delivered' | 'cancelled';

export interface OrderItem {
  menuItemId: string;
  name: string;
  /** หน่วยเป็นสตางค์ เพื่อเลี่ยงความคลาดเคลื่อนของทศนิยม ตาม claude.md §7 */
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  riderId?: string;
  status: OrderStatus;
  items: OrderItem[];
  /** ทั้งสามค่าแยกกันเสมอ ห้ามรวบเป็นก้อนเดียว ตาม claude.md §3 หลักการ 2 */
  foodTotal: number;
  deliveryFee: number;
  serviceFee: number;
  createdAt: string;
}
