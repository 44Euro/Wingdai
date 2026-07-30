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
  /**
   * ระยะทางจากที่อยู่ของผู้ใช้ถึงร้าน (กม.) — density ตาม claude.md §1
   * `null` = ยังไม่รู้ว่าผู้ใช้อยู่ไหน (ยังไม่ล็อกอิน หรือยังไม่มีที่อยู่) จอต้องซ่อนไป
   * **ห้ามแทนด้วยเลขสมมติ** ระยะทางผิดทำให้ลูกค้าตัดสินใจผิดและไรเดอร์รับงานผิด
   */
  distanceKm: number | null;
  /** ค่าคงที่ที่ร้านตั้งเอง — seed cold-start ให้ dispatch (§6.3) */
  prepTimeMinutes: number;
  /**
   * คะแนนเฉลี่ย 0–5 · `null` = ยังไม่มีใครรีวิว (ระบบรีวิวอยู่คลื่นที่ 3)
   * โชว์ ★ 4.8 ให้ร้านที่ไม่เคยมีรีวิวคือการหลอกลูกค้า ไม่ใช่ placeholder — จอต้องซ่อนไป
   */
  rating: number | null;
}

export interface OptionChoice {
  id: string;
  name: string;
  /** ส่วนต่างราคาเป็นสตางค์ (0 = ฟรี) */
  priceDelta: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  /** จำนวนที่ต้องเลือกอย่างน้อย (0 = ไม่บังคับ) */
  minSelect: number;
  /** จำนวนที่เลือกได้มากสุด (min=max=1 = radio) */
  maxSelect: number;
  choices: OptionChoice[];
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
  optionGroups?: OptionGroup[];
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

/** claude.md §7 — ที่อยู่ต้องมีพิกัด เพราะระยะทางและการจ่ายงานคิดจากพิกัด ไม่ใช่จากข้อความ */
export interface Address {
  id: string;
  label: string;
  addressText: string;
  note?: string;
  lat: number;
  lng: number;
}

/**
 * ช่องทางชำระเงิน (claude.md §6.5)
 * `card` มีในรายการแต่ยังเลือกไม่ได้ จนกว่าจะตัดสินใจเรื่อง payment gateway (§11 ข้อ 3)
 */
export type PaymentMethod = 'promptpay' | 'cash' | 'card';

/** เงินสดเป็น 'pending' จนกว่าไรเดอร์จะเก็บตอนส่ง ส่วนพร้อมเพย์จ่ายจบตั้งแต่ก่อนออร์เดอร์เดิน */
export type PaymentStatus = 'pending' | 'paid';

export interface Order {
  id: string;
  /** เลขที่ที่ลูกค้าเห็นและใช้อ้างตอนแจ้งปัญหา (WD-XXXXXX) — ไม่ใช่ uuid ที่อ่านไม่ออก */
  reference: string;
  customerId: string;
  restaurantId: string;
  riderId?: string;
  status: OrderStatus;
  items: OrderItem[];
  /** ทั้งสามค่าแยกกันเสมอ ห้ามรวบเป็นก้อนเดียว ตาม claude.md §3 หลักการ 2 */
  foodTotal: number;
  deliveryFee: number;
  serviceFee: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
}
