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

/**
 * เงินสดเป็น 'pending' จนกว่าไรเดอร์จะเก็บตอนส่ง ส่วนพร้อมเพย์จ่ายจบตั้งแต่ก่อนออร์เดอร์เดิน
 * `refunded` เกิดเมื่อแอดมินอนุมัติคืนเงิน (§6.4) — ต้องมีในชนิดนี้ ไม่งั้นจอที่แยกตามสถานะ
 * จะพลาดเคสนี้เงียบ ๆ ทั้งที่เซิร์ฟเวอร์ส่งมาจริง
 */
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

/** ร้านตามที่เจ้าของเห็น — ต่างจาก `Restaurant` ที่เป็นมุมของลูกค้า (ไม่มีระยะทาง/คะแนน) */
export interface MerchantRestaurant {
  id: string;
  name: string;
  /** แอดมินเป็นคนอนุมัติ ร้านแก้เองไม่ได้ */
  isApproved: boolean;
  /** ร้านกดเปิด/ปิดรับออร์เดอร์เอง */
  isOpen: boolean;
  prepTimeMinutes: number;
}

/**
 * ออร์เดอร์ตามที่ครัวเห็น
 *
 * **ไม่มีเบอร์โทรลูกค้า** โดยตั้งใจ — ร้านไม่ได้เป็นคนไปส่ง ไรเดอร์ต่างหากที่ต้องติดต่อ
 * และ **ไม่มีค่าส่ง/ค่าบริการ** เพราะไม่ใช่เงินของร้าน โชว์ไปมีแต่ทำให้ร้านคาดหวังยอดผิด
 */
export interface MerchantOrder {
  id: string;
  reference: string;
  restaurantId: string;
  restaurantName: string;
  status: OrderStatus;
  customerName: string;
  items: { name: string; unitPrice: number; quantity: number }[];
  foodTotal: number;
  /** 15% ที่แช่แข็งไว้ตอนสั่ง (claude.md §6.1) ไม่ใช่คำนวณสดตอนอ่าน */
  commission: number;
  /** ยอดที่ร้านได้จริงจากใบนี้ = foodTotal − commission */
  restaurantPayout: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** ร้านรู้แค่ว่ามีไรเดอร์มารับหรือยัง ไม่ต้องรู้ว่าใคร */
  hasRider: boolean;
  createdAt: string;
  acceptedAt: string | null;
}

/** ร้านที่รอแอดมินตรวจ (§4.3 · §7) */
export interface PendingRestaurant extends MerchantRestaurant {
  ownerName: string;
  ownerPhone: string;
  addressText: string;
  /** §7 ต้องมีเมนูตั้งต้นก่อนถึงจะส่งตรวจได้ — แอดมินต้องเห็นว่ามีกี่รายการ */
  menuItemCount: number;
  createdAt: string;
}

/** งานหนึ่งใบตามที่ไรเดอร์เห็น — มีทั้งจุดรับและจุดส่ง เพราะต้องนำทางไปทั้งสองที่ */
export interface RiderJob {
  orderId: string;
  reference: string;
  status: 'accepted' | 'preparing' | 'picked_up';
  restaurantName: string;
  restaurantAddress: string;
  restaurantLat: number;
  restaurantLng: number;
  dropoffAddress: string;
  dropoffNote: string | null;
  dropoffLat: number;
  dropoffLng: number;
  items: { name: string; quantity: number }[];
  /** ค่าตอบแทนของไรเดอร์ใบนี้ = ค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่าย */
  riderPaySatang: number;
  /** ต้องเก็บเงินสดกี่สตางค์ · 0 = ลูกค้าจ่ายมาแล้ว (รวมกรณีเปลี่ยนเป็นพร้อมเพย์กลางทาง §6.5) */
  collectCashSatang: number;
}

/** งานที่ถูกเสนอให้ตอบภายใน 15 วินาที (claude.md §6.3) */
export interface RiderOffer extends RiderJob {
  offerId: string;
  expiresAt: string;
}

export interface RiderStatus {
  approval: RiderApprovalStatus;
  isOnline: boolean;
  onlineSince: string | null;
  /**
   * §6.2 เงินสดในมือกับเพดาน — จอต้องบอกล่วงหน้าว่าใกล้เต็มแล้ว
   * ไม่ใช่ปล่อยให้ไรเดอร์งงว่าทำไมอยู่ ๆ ไม่มีงานเงินสดเข้ามา
   */
  cashHeldSatang: number;
  cashLimitSatang: number;
  activeJobs: RiderJob[];
  offer: RiderOffer | null;
}

/** งานที่ส่งสำเร็จแล้ว — แถวหนึ่งในประวัติงานของไรเดอร์ (design R6) */
export interface RiderDelivery {
  orderId: string;
  reference: string;
  restaurantName: string;
  dropoffAddress: string;
  deliveredAt: string;
  /** ค่าตอบแทนของใบนี้ = ค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่าย */
  riderPaySatang: number;
  paymentMethod: PaymentMethod;
}

/**
 * จอรายได้ของไรเดอร์ (design R4 + R6)
 *
 * ไม่มีอันดับ ไม่มีค่าเฉลี่ยเทียบไรเดอร์คนอื่น และไม่มีเป้าที่ต้องวิ่งให้ถึง —
 * claude.md §3 ข้อ 4 ห้ามสร้างตัวเลขที่กดดันให้ไรเดอร์ขับเร็วขึ้น
 */
export interface RiderEarnings {
  hours: number;
  delivered: number;
  /** null = ยังไม่เคยออนไลน์ จึงยังคำนวณไม่ได้ — ไม่ใช่ 0 ซึ่งอ่านเหมือน "ทำได้แย่" */
  ordersPerHour: number | null;
  sinceDays: number;
  totalPaySatang: number;
  deliveries: RiderDelivery[];
}

/** ยอดขายของร้านในช่วงเวลาหนึ่ง — ทุกช่องเป็นจำนวนเต็มสตางค์ */
export interface MerchantSales {
  orders: number;
  foodSalesSatang: number;
  /** 15% ของค่าอาหาร ตามที่แช่แข็งไว้ตอนสั่ง (§6.1) */
  commissionSatang: number;
  /** ยอดที่ร้านได้จริง = ค่าอาหาร − คอมมิชชัน (ค่าส่ง/ค่าบริการไม่ใช่ของร้าน) */
  netSatang: number;
}

/** จอสรุปของร้าน (design M1 + M5) */
export interface MerchantSummary {
  today: MerchantSales;
  last7Days: MerchantSales;
  /** ใบที่ครัวยังต้องทำ — ต้องเห็นก่อนตัวเลขเงินเสมอ */
  openQueue: number;
  restaurantCount: number;
}

/** โซนที่เปิดให้บริการ — ชนิดโซนเป็นข้อมูล ไม่ใช่ตรรกะที่แตกสาขา (claude.md §7) */
export interface Zone {
  id: string;
  name: string;
  type: 'university' | 'condo_cluster' | 'office_district' | 'mixed';
}

/** ข้อมูลในใบสมัครไรเดอร์ (design R5 · claude.md §7) */
export interface RiderApplicationProfile {
  nationalId: string;
  dateOfBirth: string;
  vehicleRegistration: string;
  licenceExpiry: string;
  compulsoryInsuranceExpiry: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredZoneId: string | null;
}

/**
 * สถานะใบสมัครไรเดอร์
 *
 * `none` (ยังไม่เคยส่ง) ต่างจาก `pending` (ส่งแล้วรอตรวจ) อย่างมีนัยสำคัญ —
 * คนที่เพิ่งสมัครบัญชี rider จะเป็น `none` ถ้าจอไม่แยกสองอย่างนี้ เขาจะนั่งรอ
 * การอนุมัติที่ไม่มีวันมาถึง เพราะแอดมินไม่มีใบสมัครให้ตรวจเลย
 */
export interface RiderApplication {
  status: 'none' | RiderApprovalStatus;
  rejectionReason: string | null;
  profile: RiderApplicationProfile | null;
}

export interface RiderApplicationInput extends Omit<RiderApplicationProfile, 'preferredZoneId'> {
  preferredZoneId?: string;
  acceptContract: boolean;
  acceptPdpa: boolean;
}

/** ใบสมัครที่รอแอดมินตรวจ */
export interface PendingRider extends RiderApplicationProfile {
  accountId: string;
  fullName: string;
  phone: string;
  zoneName: string | null;
  /** ชื่อบัญชีตรงกับชื่อตามกฎหมายไหม — ธงกันบัญชีม้า (§7) ไม่ใช่การตัดสินอัตโนมัติ */
  bankNameMatches: boolean;
}

/**
 * ไรเดอร์ที่ยังถือเงินสดของบริษัทอยู่ (claude.md §6.2)
 *
 * เงินสดที่ลูกค้าจ่ายเป็นของแพลตฟอร์มตั้งแต่วินาทีแรก แค่บังเอิญอยู่ในกระเป๋าไรเดอร์
 * ไม่ใช่หนี้ที่ไรเดอร์ติดบริษัท — ไรเดอร์ไม่เคยออกเงินเอง
 */
export interface RiderCashHolder {
  accountId: string;
  fullName: string;
  phone: string;
  cashHeldSatang: number;
  cashLimitSatang: number;
  /** ชนเพดานแล้ว = ไม่ได้รับงานเงินสดต่อจนกว่าจะนำเงินมาส่ง */
  atLimit: boolean;
}

export interface CashSettlement {
  riderAccountId: string;
  settledSatang: number;
  /** ยอดที่เหลือหลังนำส่ง */
  cashHeldSatang: number;
}

/** เหตุผลที่ลูกค้าแจ้งปัญหาได้ — ตัวที่ตัดสินว่าใครรับผิดชอบตาม claude.md §6.4 */
export type RefundReason =
  | 'wrong_item' | 'missing_item' | 'food_quality'
  | 'damaged' | 'not_delivered' | 'late' | 'other';

export type RefundFault = 'restaurant' | 'rider' | 'platform';

export interface RefundCase {
  id: string;
  orderId: string;
  reference?: string;
  customerName?: string;
  status: 'open' | 'auto_verified' | 'approved' | 'rejected';
  customerReason: string;
  autoVerdict: string | null;
  /**
   * เหตุผลรายข้อจากการตรวจอัตโนมัติ — §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ
   * แอดมินต้องอ่านได้ว่าระบบคิดยังไงก่อนกดยืนยัน
   */
  reasoning: string[];
  suggestedAmountSatang: number | null;
  approvedAmountSatang: number | null;
  fault: RefundFault | null;
  createdAt: string;
  decidedAt: string | null;
}

/** สิ่งที่ต้องมีคนเข้าไปยุ่ง (claude.md §7) — ไม่ใช่ฟีดออร์เดอร์ทั้งหมด */
export interface OrderException {
  kind: 'unaccepted' | 'no_rider' | 'slow_delivery' | 'open_dispute';
  orderId: string;
  reference: string;
  restaurantName: string;
  status: OrderStatus;
  minutesWaiting: number;
  /** บอกว่าต้องทำอะไร ไม่ใช่แค่ว่ามีอะไรผิด */
  detail: string;
}

/**
 * ตัวเลขจาก claude.md §8
 * ค่าที่ยังวัดไม่ได้เป็น `null` ไม่ใช่ 0 — 0 อ่านเหมือน "แย่มาก" หรือ "ดีมาก"
 * แล้วแต่ตัวชี้วัด ทั้งที่ความจริงคือยังไม่มีข้อมูล
 */
export interface AdminMetrics {
  windowDays: number;
  orders: number;
  delivered: number;
  ordersPerRiderHour: number | null;
  restaurantAcceptRate: number | null;
  refundRate: number | null;
  autoDispatchRate: number | null;
}

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
