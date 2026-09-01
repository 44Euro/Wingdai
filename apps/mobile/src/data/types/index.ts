export type AccountType = 'user' | 'rider' | 'admin' | 'super_admin';
export type Capability = 'customer' | 'merchant' | 'rider' | 'admin' | 'superAdmin';
export type RiderApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Account {
  id: string;
  accountType: AccountType;
  username: string;
  fullName: string;
  phone: string;
  /** login alias เสริม ไม่ผ่าน OTP verify, phone ยังเป็น verified channel เดียว ตาม product-spec §4.2 */
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
  /** เปิดรับออร์เดอร์อยู่จริงไหม เซิร์ฟเวอร์รวมตารางเวลากับการพักมาให้แล้ว (design M11) */
  isOpen: boolean;
  /** รอบเปิดถัดไป (ISO) `null` = เปิดอยู่ หรือร้านไม่ได้ตั้งตาราง จอเขียน "เปิด 16:00" จากค่านี้ */
  opensAt: string | null;
  cuisine: CuisineCategory;
  /** ระยะทางจากที่อยู่ของผู้ใช้ถึงร้าน (กม.) density ตาม product-spec §1 */
  distanceKm: number | null;
  /** ค่าคงที่ที่ร้านตั้งเอง seed cold-start ให้ dispatch (§6.3) */
  prepTimeMinutes: number;
  /** คะแนนเฉลี่ย 0–5 `null` = ยังไม่มีใครรีวิว (ระบบรีวิวอยู่คลื่นที่ 3) */
  rating: number | null;
  /** รูปหน้าร้าน `null`/ไม่มี = จอวาดกล่องไล่สีพร้อมไอคอนหมวดแทน */
  photoUrl?: string | null;
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
  /** สตางค์ (product-spec §7) */
  price: number;
  category: CuisineCategory;
  isAvailable: boolean;
  /** รูปจาน `null`/ไม่มี = จอวาดกล่องไล่สีพร้อมไอคอนหมวดแทน */
  photoUrl?: string | null;
  optionGroups?: OptionGroup[];
}

export type OrderStatus =
  | 'created' | 'accepted' | 'preparing' | 'picked_up' | 'delivered' | 'cancelled';

export interface OrderItem {
  menuItemId: string;
  /** ชื่อที่แช่แข็งไว้ตอนสั่ง รวมตัวเลือกในวงเล็บ ใบเสร็จเก่าต้องไม่เปลี่ยนตามเมนูที่ร้านแก้ทีหลัง */
  name: string;
  /** ข้อความที่ลูกค้าฝากถึงร้านสำหรับจานนี้ */
  note?: string;
  /** ตัวเลือกที่ลูกค้าเลือก แยกเป็นรายการ ตรงกับ `order_items.selected_choices` ฝั่งเซิร์ฟเวอร์ */
  choiceNames: string[];
  /** id ของตัวเลือกเดียวกันนั้น ใช้ประกอบตะกร้าใบเดิมขึ้นมาใหม่ตอนสั่งซ้ำ (design C33) */
  choiceIds: string[];
  /** หน่วยเป็นสตางค์ เพื่อเลี่ยงความคลาดเคลื่อนของทศนิยม ตาม product-spec §7 */
  unitPrice: number;
  quantity: number;
}

/** product-spec §7 ที่อยู่ต้องมีพิกัด เพราะระยะทางและการจ่ายงานคิดจากพิกัด ไม่ใช่จากข้อความ */
export interface Address {
  id: string;
  label: string;
  addressText: string;
  note?: string;
  lat: number;
  lng: number;
}

/** ช่องทางชำระเงิน (product-spec §6.5) */
export type PaymentMethod = 'promptpay' | 'cash' | 'card';

/** ค่าที่เซิร์ฟเวอร์บอกแอปตอนเปิดแอป ไม่ต้องล็อกอิน */
export interface PlatformConfig {
  /** ช่องทางที่เซิร์ฟเวอร์ยอมรับจริงตอนนี้ เรียงตามลำดับที่ควรแสดง (พร้อมเพย์มาก่อนเสมอ) */
  paymentMethods: PaymentMethod[];
  registrationOpen: boolean;
}

/** เงินสดเป็น 'pending' จนกว่าไรเดอร์จะเก็บตอนส่ง ส่วนพร้อมเพย์จ่ายจบตั้งแต่ก่อนออร์เดอร์เดิน */
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

/** ร้านตามที่เจ้าของเห็น ต่างจาก `Restaurant` ที่เป็นมุมของลูกค้า (ไม่มีระยะทาง/คะแนน) */
/** `null` = ปิดทั้งวัน เวลาเป็น `HH:MM` ตามเวลาไทย (design M11) */
export type DayHours = { open: string; close: string } | null;
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type WeeklyHours = Partial<Record<Weekday, DayHours>>;

export interface MerchantRestaurant {
  id: string;
  name: string;
  /** แอดมินเป็นคนอนุมัติ ร้านแก้เองไม่ได้ */
  isApproved: boolean;
  /** ร้านกดเปิด/ปิดรับออร์เดอร์เอง */
  isOpen: boolean;
  prepTimeMinutes: number;
  /** ตารางเวลาที่ร้านตั้งไว้ ว่าง = ยังไม่เคยตั้ง ซึ่งแปลว่าเปิดตลอดเวลาที่สวิตช์เปิด */
  openingHours: WeeklyHours;
  /** พักรับออร์เดอร์ถึงเมื่อไหร่ (ISO) `null` = ไม่ได้พัก */
  pausedUntil: string | null;
  /** รับออร์เดอร์ได้จริงไหมตอนนี้ เซิร์ฟเวอร์คิดมาให้แล้ว รวมสวิตช์ ตาราง และการพัก */
  isAcceptingOrders: boolean;
}

/** ออร์เดอร์ตามที่ครัวเห็น */
export interface MerchantOrder {
  id: string;
  reference: string;
  restaurantId: string;
  restaurantName: string;
  status: OrderStatus;
  customerName: string;
  items: { name: string; unitPrice: number; quantity: number; note?: string }[];
  foodTotal: number;
  /** 15% ที่แช่แข็งไว้ตอนสั่ง (product-spec §6.1) ไม่ใช่คำนวณสดตอนอ่าน */
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

/** ร้านที่รอแอดมินตรวจ (§4.3 §7) */
export interface PendingRestaurant extends MerchantRestaurant {
  ownerName: string;
  ownerPhone: string;
  addressText: string;
  /** §7 ต้องมีเมนูตั้งต้นก่อนถึงจะส่งตรวจได้ แอดมินต้องเห็นว่ามีกี่รายการ */
  menuItemCount: number;
  createdAt: string;
}

/** งานหนึ่งใบตามที่ไรเดอร์เห็น มีทั้งจุดรับและจุดส่ง เพราะต้องนำทางไปทั้งสองที่ */
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
  /** §6.3 ไรเดอร์ที่ถึงร้านก่อนอาหารเสร็จต้องยืนรอฟรี รายได้ต่อชั่วโมงตก แล้วก็เลิกทำ */
  prepTimeMinutes: number;
  acceptedAt: string | null;
  /** ของในถุงตามที่ไรเดอร์ต้องตรวจก่อนออกจากร้าน (design R10) */
  items: { name: string; quantity: number; note: string | null; choiceNames: string[] }[];
  /** ค่าตอบแทนของไรเดอร์ใบนี้ = ค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่าย */
  riderPaySatang: number;
  /** ต้องเก็บเงินสดกี่สตางค์ 0 = ลูกค้าจ่ายมาแล้ว (รวมกรณีเปลี่ยนเป็นพร้อมเพย์กลางทาง §6.5) */
  collectCashSatang: number;
  /** ลูกค้าขอให้วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
  leaveAtDoor: boolean;
}

/** งานที่ถูกเสนอให้ตอบภายใน 15 วินาที (product-spec §6.3) */
export interface RiderOffer extends RiderJob {
  offerId: string;
  expiresAt: string;
}

export interface RiderStatus {
  approval: RiderApprovalStatus;
  isOnline: boolean;
  onlineSince: string | null;
  /** §6.2 เงินสดในมือกับเพดาน จอต้องบอกล่วงหน้าว่าใกล้เต็มแล้ว */
  cashHeldSatang: number;
  cashLimitSatang: number;
  /** ตำแหน่งล่าสุดที่ส่งมา null = ยังไม่เคยเปิดตำแหน่ง (จอ R7 ใช้เป็นหมุดตั้งต้น) */
  lastLocation: { lat: number; lng: number } | null;
  activeJobs: RiderJob[];
  offer: RiderOffer | null;
}

/** ช่วงเวลาของจอรายได้ (design R6 ชิปสามอันบนหัวจอ) */
export type EarningsPeriod = 'today' | 'week' | 'month';

/** งานที่ส่งสำเร็จแล้ว แถวหนึ่งในประวัติงานของไรเดอร์ (design R6) */
export interface RiderDelivery {
  orderId: string;
  reference: string;
  restaurantName: string;
  dropoffAddress: string;
  deliveredAt: string;
  /** ค่าตอบแทนของใบนี้ = ค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่าย */
  riderPaySatang: number;
  paymentMethod: PaymentMethod;
  /** ระยะร้าน→ปลายทางเป็นเส้นตรง (กม.) ระยะตามถนนต้องรอ OSRM */
  distanceKm: number;
  /** เวลาตั้งแต่รับของจนส่งถึง (นาที) 0 = ใช้เวลาไม่ถึงหนึ่งนาที */
  durationMinutes: number;
}

/** จอรายได้ของไรเดอร์ (design R4 + R6) */
export interface RiderEarnings {
  hours: number;
  delivered: number;
  /** null = ยังไม่เคยออนไลน์ จึงยังคำนวณไม่ได้ ไม่ใช่ 0 ซึ่งอ่านเหมือน "ทำได้แย่" */
  ordersPerHour: number | null;
  /** ช่วงที่ตัวเลขทั้งก้อนนี้คิดมา จอต้องสะท้อนกลับว่ากำลังดูช่วงไหนอยู่ */
  period: EarningsPeriod;
  totalPaySatang: number;
  /** ระยะรวมของทุกเที่ยวในช่วง (กม.) */
  distanceKm: number;
  deliveries: RiderDelivery[];
}

/** จุดตั้งทำงานของไรเดอร์ (design R7) */
export interface RiderWorkBase {
  lat: number;
  lng: number;
  radiusKm: number;
}

export type RiderPayoutStatus = 'requested' | 'paid' | 'rejected';

/** คำขอถอนเงินหนึ่งใบ (design R12) */
export interface RiderPayout {
  id: string;
  amountSatang: number;
  status: RiderPayoutStatus;
  rejectionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

/** ยอดเงินของไรเดอร์ (design R12 product-spec §6.2) */
export interface RiderBalance {
  payableSatang: number;
  cashHeldSatang: number;
  /** รายได้ค้างจ่าย − เงินสดในมือ ติดลบได้ ห้ามปัดเป็นศูนย์ */
  withdrawableSatang: number;
  pending: RiderPayout | null;
}

/** ยอดขายของร้านในช่วงเวลาหนึ่ง ทุกช่องเป็นจำนวนเต็มสตางค์ */
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
  /** ใบที่ครัวยังต้องทำ ต้องเห็นก่อนตัวเลขเงินเสมอ */
  openQueue: number;
  restaurantCount: number;
}

/** โซนที่เปิดให้บริการ ชนิดโซนเป็นข้อมูล ไม่ใช่ตรรกะที่แตกสาขา (product-spec §7) */
export interface Zone {
  id: string;
  name: string;
  type: 'university' | 'condo_cluster' | 'office_district' | 'mixed';
}

/** ข้อมูลในใบสมัครไรเดอร์ (design R5 product-spec §7) */
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

/** สถานะใบสมัครไรเดอร์ */
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
  /** ชื่อบัญชีตรงกับชื่อตามกฎหมายไหม ธงกันบัญชีม้า (§7) ไม่ใช่การตัดสินอัตโนมัติ */
  bankNameMatches: boolean;
}

/** ไรเดอร์ที่ยังถือเงินสดของบริษัทอยู่ (product-spec §6.2) */
export interface RiderCashHolder {
  accountId: string;
  fullName: string;
  phone: string;
  cashHeldSatang: number;
  cashLimitSatang: number;
  /** ชนเพดานแล้ว = ไม่ได้รับงานเงินสดต่อจนกว่าจะนำเงินมาส่ง */
  atLimit: boolean;
}

/** คำขอถอนเงินที่รอแอดมินตัดสิน (design R12 product-spec §10 "กึ่งอัตโนมัติ") */
export interface PendingRiderPayout {
  id: string;
  accountId: string;
  fullName: string;
  phone: string;
  amountSatang: number;
  requestedAt: string;
}

export interface CashSettlement {
  riderAccountId: string;
  settledSatang: number;
  /** ยอดที่เหลือหลังนำส่ง */
  cashHeldSatang: number;
}

/** เหตุผลที่ลูกค้าแจ้งปัญหาได้ ตัวที่ตัดสินว่าใครรับผิดชอบตาม product-spec §6.4 */
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
  /** เหตุผลรายข้อจากการตรวจอัตโนมัติ §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ */
  reasoning: string[];
  suggestedAmountSatang: number | null;
  approvedAmountSatang: number | null;
  fault: RefundFault | null;
  createdAt: string;
  decidedAt: string | null;
}

/** สิ่งที่ต้องมีคนเข้าไปยุ่ง (product-spec §7) ไม่ใช่ฟีดออร์เดอร์ทั้งหมด */
/** เอกสารที่ไรเดอร์ต้องส่งก่อนได้รับอนุมัติ (design R8 product-spec §7) */
export type RiderDocumentKind =
  | 'selfie' | 'id_card_front' | 'id_card_back' | 'licence' | 'vehicle_book' | 'insurance';

/** สถานะเอกสารหนึ่งชนิด */
export interface RiderDocument {
  kind: RiderDocumentKind;
  status: 'missing' | 'reviewing' | 'verified' | 'rejected';
  rejectionReason: string | null;
  uploadedAt: string | null;
}

/** ปัญหาที่ไรเดอร์แจ้งระหว่างส่ง (design R9) */
export type RiderIssueKind = 'cannot_reach_customer' | 'bad_address' | 'accident';

export interface OrderException {
  kind: 'unaccepted' | 'no_rider' | 'slow_delivery' | 'open_dispute' | 'rider_issue';
  orderId: string;
  reference: string;
  restaurantName: string;
  status: OrderStatus;
  minutesWaiting: number;
  /** บอกว่าต้องทำอะไร ไม่ใช่แค่ว่ามีอะไรผิด */
  detail: string;
  /** มีเฉพาะเรื่องที่ไรเดอร์แจ้ง (R9) แอดมินต้องใช้ id นี้กดเคลียร์ */
  riderIssueId?: string;
}

/** ตัวเลขจาก product-spec §8 */
export interface AdminMetrics {
  windowDays: number;
  orders: number;
  delivered: number;
  ordersPerRiderHour: number | null;
  restaurantAcceptRate: number | null;
  refundRate: number | null;
  autoDispatchRate: number | null;

  /** ห้าตัวที่เหลือของ §8 เติมเข้ามาเพื่อ SA1 ที่ต้องครบเก้าตัว */
  contributionPerOrderSatang: number | null;
  medianDeliveryMinutes: number | null;
  onTimeRate: number | null;
  promptPayRate: number | null;
  repeatOrderRate: number | null;
}

/** ตัวกรองของจอเฝ้าออร์เดอร์ (design AD2) นิยาม "ช้า"/"ไม่มีไรเดอร์" อยู่ฝั่งเซิร์ฟเวอร์ */
export type AdminOrderFilter = 'all' | 'delayed' | 'unassigned';

export interface AdminOrderRow {
  id: string;
  reference: string;
  status: OrderStatus;
  restaurantName: string;
  dropoffLabel: string;
  /** null = ยังไม่มีไรเดอร์ ห้ามแทนด้วย "-" หรือ "ไม่ระบุ" (§10 ไม่รู้ = ซ่อน ไม่ใช่เติม) */
  riderName: string | null;
  grandTotalSatang: number;
  createdAt: string;
  minutesElapsed: number;
}

/** ตัวเลข "ตอนนี้" ของจอ AD1 คนละเรื่องกับ `AdminMetrics` ที่เป็นตัวเลขย้อนหลัง */
export interface LiveOps {
  activeOrders: number;
  ridersOnline: number;
  unassigned: number;
  gmvTodaySatang: number;
  /** null = วันนี้ยังไม่มีใบไหนส่งสำเร็จ จอต้องซ่อนทั้งแถว ไม่ใช่โชว์ 0 */
  medianDeliveryMinutes: number | null;
}

/** ยอดที่ร้านหนึ่งค้างรับ (design AD7) */
export interface RestaurantPayable {
  restaurantId: string;
  name: string;
  ownerName: string;
  payableSatang: number;
  orderCount: number;
}

export interface OpsMapRider {
  accountId: string;
  fullName: string;
  lat: number;
  lng: number;
  busy: boolean;
  lastPingAt: string | null;
}

export interface OpsMapOrder {
  id: string;
  reference: string;
  lat: number;
  lng: number;
  status: OrderStatus;
  hasRider: boolean;
}

/** ภาพรวมแผนที่ ops (design AD8) ไม่มีเส้นทาง ดู opsMap.service.ts ว่าทำไม */
export interface OpsMapData {
  riders: OpsMapRider[];
  orders: OpsMapOrder[];
}

/** เอกสาร KYC ตามที่แอดมินเห็น (design AD6) มีลิงก์ดูรูปเพิ่มจากที่ไรเดอร์เห็น */
export type RiderDocumentWithUrl = RiderDocument & {
  /** signed URL อายุสั้น null = ยังไม่ส่งเอกสารชนิดนี้ */
  url: string | null;
};

/** ── แชทของออร์เดอร์ (design C10 M10) ───────────────────────────────────── */

/** สองช่องแยกกันเด็ดขาด ไม่ใช่ห้องรวมสามคน ร้านไม่เห็นสิ่งที่ลูกค้าบอกไรเดอร์ */
export type ChatChannel = 'customer_rider' | 'customer_merchant';

export interface ChatMessage {
  id: string;
  senderAccountId: string;
  senderName: string;
  /** ข้อความของตัวเองชิดขวา ของอีกฝ่ายชิดซ้าย จอไม่ต้องรู้ว่า "ตัวเอง" คือ id ไหน */
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface ChatThread {
  orderId: string;
  channel: ChatChannel;
  /** ชื่อคนที่กำลังคุยด้วย null = ยังไม่มีไรเดอร์ */
  peerName: string | null;
  /** งานจบแล้ว = อ่านได้อย่างเดียว ไม่ใช่ห้องหายไป */
  closed: boolean;
  messages: ChatMessage[];
}

/** ── รีวิว (design C11 C36 M9) ────────────────────────────────────────── */

/** รีวิวหนึ่งใบ ผูกกับออร์เดอร์เสมอ และหนึ่งใบเขียนได้ครั้งเดียว */
export interface Review {
  id: string;
  orderId: string;
  authorName: string;
  restaurantRating: number;
  /** null = ใบนั้นไม่มีไรเดอร์ หรือลูกค้าเลือกไม่ให้คะแนนเขา (เช่นวางไว้หน้าประตู) */
  riderRating: number | null;
  comment: string | null;
  /** URL เปิดได้เลย จอไม่ต้องรู้ว่าบักเก็ตชื่ออะไร */
  photoUrls: string[];
  /** ชื่อจานแรกของใบนั้น ดีไซน์ C36 โชว์ "2 วันก่อน ข้าวกะเพราหมูสับ" */
  itemName: string | null;
  createdAt: string;
}

/** หนึ่งแท่งของสรุปคะแนน ห้าถึงหนึ่งดาว เรียงมากไปน้อย รวมระดับที่ไม่มีใครให้ */
export interface RatingBar {
  stars: 1 | 2 | 3 | 4 | 5;
  count: number;
}

export interface ReviewSummary {
  /** null = ยังไม่มีใครรีวิว จอต้องซ่อนคะแนน ไม่ใช่โชว์ 0 ดาว (§10) */
  average: number | null;
  count: number;
  breakdown: RatingBar[];
  reviews: Review[];
}

/** ── ตั๋วซัพพอร์ต (design AD4) ─────────────────────────────────────────────── */

/** รายการปิด ต้องตรงกับ enum `ticket_kind` ฝั่งเซิร์ฟเวอร์ ชนิดคือสิ่งที่แอดมินใช้กรองคิว */
export type TicketKind = 'order_problem' | 'payment' | 'account' | 'other';

/** สองค่าเท่านั้น ดีไซน์วาด `escalated` ไว้ด้วยแต่ไม่ได้ทำ */
export type TicketStatus = 'open' | 'closed';

export interface SupportTicket {
  id: string;
  /** null = ตั๋วที่ไม่ได้ผูกกับออร์เดอร์ใบไหน (เรื่องบัญชี/การจ่ายเงิน) */
  orderId: string | null;
  orderReference: string | null;
  kind: TicketKind;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  openedByName: string;
  /** 1 = ยังไม่มีใครตอบเลย */
  messageCount: number;
}

export interface SupportMessage {
  id: string;
  authorAccountId: string;
  authorName: string;
  /** คนอ่านต้องแยกออกว่าใครเป็นทีมงาน ไม่ใช่เดาจากชื่อ */
  fromStaff: boolean;
  body: string;
  createdAt: string;
}

export interface SupportThread {
  ticket: {
    id: string;
    orderId: string | null;
    kind: TicketKind;
    subject: string;
    status: TicketStatus;
    createdAt: string;
  };
  /** เรียงเก่า→ใหม่ อ่านจากบนลงล่างเหมือนบทสนทนา */
  messages: SupportMessage[];
  /** ตอบอัตโนมัตินอกเวลาทำการ (design AD4) null = อยู่ในเวลาทำการ หรือมีคนตอบแล้ว */
  autoReply: { nextOpenAt: string } | null;
}

/** ── ซูเปอร์แอดมิน (design SA1–SA6) ──────────────────────────────────────── */

/** โซนพร้อมตัวเลขของมัน (design SA2) โซนเป็น รายงาน ไม่ใช่ด่านกั้นอีกแล้ว (product-spec §7) */
export type ZoneReport = Zone & {
  lat: number;
  lng: number;
  liveOrders: number;
  ridersOnline: number;
  /** ยอดขายรวม 30 วันของโซนนี้ */
  gmvSatang: number;
};

export type ZoneInput = Pick<Zone, 'name' | 'type'> & { lat: number; lng: number };

/** บัญชีผู้ดูแลระบบหนึ่งคน (design SA3) */
export interface AdminAccountRow {
  accountId: string;
  username: string;
  fullName: string;
  phone: string;
  role: AccountType;
}

/** feature flag ที่มีผลกับเซิร์ฟเวอร์จริง สี่ตัว (design SA4) */
export type FeatureFlagKey =
  | 'cash_payment' | 'card_payment' | 'auto_dispatch' | 'registration_open';

/** ราคาที่ตั้งค่าได้ (design SA6) ทุกช่องเป็นจำนวนเต็ม, สองช่องล่างเป็นสตางค์ */
export interface PlatformPricing {
  /** จุดฐาน: 1500 = 15% ตาม product-spec §6.1 */
  commissionRateBp: number;
  deliveryBaseSatang: number;
  deliveryPerKmSatang: number;
  serviceFeeSatang: number;
  /** null = ยังไม่เคยมีใครแก้ ใช้ค่าตั้งต้นอยู่ */
  updatedAt: string | null;
}

export interface SuperConfig {
  pricing: PlatformPricing;
  flags: Record<FeatureFlagKey, boolean>;
  /** ลำดับที่จอควรแสดง มาจากเซิร์ฟเวอร์ ไม่ใช่รายการที่แอปฝังเอง */
  flagKeys: FeatureFlagKey[];
}

/** หนึ่งแถวของประวัติการกระทำ (design SA5) */
export interface AuditRow {
  id: string;
  action: string;
  actorName: string;
  actorUsername: string;
  subjectType: string;
  subjectId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface Order {
  id: string;
  /** เลขที่ที่ลูกค้าเห็นและใช้อ้างตอนแจ้งปัญหา (WD-XXXXXX) ไม่ใช่ uuid ที่อ่านไม่ออก */
  reference: string;
  customerId: string;
  restaurantId: string;
  riderId?: string;
  status: OrderStatus;
  items: OrderItem[];
  /** ทั้งสามค่าแยกกันเสมอ ห้ามรวบเป็นก้อนเดียว ตาม product-spec §3 หลักการ 2 */
  foodTotal: number;
  deliveryFee: number;
  serviceFee: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  /** พิกัดสามจุดของจอติดตาม (design C6) */
  restaurantLat: number | null;
  restaurantLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  /** ตำแหน่งไรเดอร์ null = ยังไม่มีไรเดอร์ ยังไม่เคยส่งพิกัด หรืองานจบไปแล้ว */
  riderLocation: { lat: number; lng: number } | null;
  /** รหัสยืนยันส่งสี่หลัก (design R11) มีเฉพาะตอนลูกค้าเจ้าของออร์เดอร์เป็นคนถาม */
  deliveryPin?: string;
  /** ทิปที่ให้ไรเดอร์ไปแล้ว (design C11) 0 = ยังไม่ให้ */
  tipSatang: number;
  /** เส้นทางรูปยืนยันส่งในบักเก็ตปิด หลักฐานให้ระบบตรวจข้อพิพาท §6.4 */
  deliveryPhotoPath?: string;
  /** ลูกค้าขอให้วางไว้หน้าประตูตอนสั่ง (สเปคคลื่น 2 §7) */
  leaveAtDoor: boolean;
  /** ใครยกเลิกและเพราะอะไร (design M12) `null` = ยังไม่ถูกยกเลิก */
  cancelledBy: CancelledBy | null;
  cancelReason: CancelReason | null;
}

/** เหตุผลที่ร้านปฏิเสธออร์เดอร์ (design M12) รายการปิด ไม่ใช่ข้อความอิสระ */
export type CancelReason = 'out_of_stock' | 'too_busy' | 'closing_soon' | 'other';
export type CancelledBy = 'customer' | 'restaurant' | 'admin';
