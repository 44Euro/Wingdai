import type {
  Account, AccountType, Address, MenuItem, MerchantOrder, MerchantRestaurant,
  Order, OrderStatus, PaymentMethod, Restaurant, RiderJob, RiderStatus, RiderEarnings,
  RefundCase, RefundReason, RefundFault, OrderException, AdminMetrics, PendingRestaurant,
  MerchantSummary, MerchantPayout, MerchantPayoutBalance, PendingMerchantPayout,
  Zone, RiderApplication, RiderApplicationInput, PendingRider,
  CashSettlement, RiderCashHolder, PendingRiderPayout, RiderBalance, RiderPayout, RiderWorkBase,
  Review, ReviewSummary, ChatChannel, ChatThread,
  EarningsPeriod, RiderIssueKind, RiderDocument, RiderDocumentKind,
  AdminOrderFilter, AdminOrderRow, LiveOps, RestaurantPayable, OpsMapData, RiderDocumentWithUrl,
  PlatformConfig, ZoneReport, ZoneInput, AdminAccountRow, FeatureFlagKey, PlatformPricing,
  SuperConfig, AuditRow, TicketKind, TicketStatus, SupportTicket, SupportThread,
  WeeklyHours, CancelReason,
} from '../types';

/** ฟอร์มเปิดร้าน (product-spec §4.3) รูปหน้าร้าน/เอกสารยังไม่มี เพราะยังไม่ได้ต่อ Storage */
export interface RegisterRestaurantInput {
  name: string;
  cuisine: MenuItem['category'];
  addressText: string;
  /** ต้องอยู่ในโซนที่เปิดให้บริการ เซิร์ฟเวอร์เช็คด้วย PostGIS ไม่ใช่เชื่อแอป */
  lat: number;
  lng: number;
  prepTimeMinutes: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  accountType: AccountType;
  /** ช่องทางรีเซ็ตรหัสผ่านเท่านั้น ไม่ใช่ identifier สำหรับล็อกอิน (product-spec §4.2) */
  email?: string;
  /** ตั๋วจาก verifyOtp พิสูจน์ว่าเบอร์นี้ยืนยันแล้ว */
  verificationToken: string;
}

/** ฟอร์มสั้นหลังผ่าน Google ไม่มีรหัสผ่าน เพราะเข้าด้วยบัญชี Google */
export interface GoogleRegisterInput {
  googleToken: string;
  username: string;
  fullName: string;
  phone: string;
  accountType: AccountType;
  verificationToken: string;
}

export type GoogleSignInResult =
  | { needsRegistration: false; account: Account }
  | {
      needsRegistration: true;
      googleToken: string;
      prefill: { email: string | null; fullName: string | null };
    };

/** แอปส่งมาแค่ "อยากได้อะไร" ไม่ส่งราคา */
export interface CreateOrderInput {
  restaurantId: string;
  items: {
    menuItemId: string;
    quantity: number;
    choiceIds: string[];
    /** ข้อความฝากถึงร้านสำหรับจานนี้ ไม่มีผลกับราคา เซิร์ฟเวอร์ยังคิดเงินเองเหมือนเดิม */
    note?: string;
  }[];
  paymentMethod: PaymentMethod;
  /** ไม่ระบุ = ใช้ที่อยู่แรกที่บันทึกไว้ */
  deliveryAddressId?: string;
  /** ขอให้วางไว้หน้าประตู (สเปคคลื่น 2 §7) ลูกค้าเป็นคนขอตอนสั่ง */
  leaveAtDoor?: boolean;
}

export interface AuthRepo {
  /** identifier รับได้ทั้ง username หรือเบอร์โทร อีเมลใช้ล็อกอินไม่ได้ (product-spec §4.2) */
  login(identifier: string, password: string): Promise<Account>;
  /** ขอรหัส OTP `devCode` มีเฉพาะตอนเซิร์ฟเวอร์ไม่ใช่ production (ยังไม่มีผู้ให้บริการ SMS) */
  requestOtp(phone: string): Promise<{ devCode?: string }>;
  /** ตรวจรหัสแล้วคืนตั๋วยืนยันเบอร์ ที่ต้องยื่นตอนสมัคร */
  verifyOtp(phone: string, code: string): Promise<string>;
  register(input: RegisterInput): Promise<Account>;
  /** ขั้นแรกของ Google sign-in Google ไม่ทดแทน OTP คนใหม่ยังต้องยืนยันเบอร์ */
  googleSignIn(idToken: string): Promise<GoogleSignInResult>;
  googleRegister(input: GoogleRegisterInput): Promise<Account>;
  /** เปิดแอปมาแล้วยังมีเซสชันค้างอยู่ไหม null = ต้องล็อกอินใหม่ */
  restore(): Promise<Account | null>;
  logout(): Promise<void>;
  /** C21 แก้โปรไฟล์ แก้ได้แค่ชื่อกับอีเมล */
  updateProfile(input: { fullName: string; email: string | null }): Promise<Account>;
  /** เปลี่ยนรหัสผ่าน ต้องยืนยันรหัสเดิมก่อน */
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<Account>;
  /** เปลี่ยนเบอร์ ต้องผ่าน OTP ของเบอร์ใหม่ก่อน เหมือนตอนสมัคร */
  changePhone(input: { phone: string; verificationToken: string }): Promise<Account>;
}

/** ข้อมูลเมนูใหม่จากหน้าเพิ่มเมนูของร้าน (ยังไม่มี id repo เป็นคนตั้ง) */
export type NewMenuItemInput = Omit<MenuItem, 'id'>;

export interface CatalogRepo {
  listRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;
  getMenu(restaurantId: string): Promise<MenuItem[]>;
  createMenuItem(input: NewMenuItemInput): Promise<MenuItem>;
  /** ค้นร้านจากชื่อร้าน "หรือ" ชื่อเมนูในร้านนั้น (design C2: "ค้นหาร้านหรือเมนู") */
  searchRestaurants(query: string): Promise<Restaurant[]>;
}

/** ร้านที่ลูกค้ากดบันทึกไว้ (design C19) */
export interface FavoritesRepo {
  /** ร้านที่บันทึกไว้ ใหม่สุดขึ้นก่อน ไม่กรองด้วยรัศมี ต่างจากรายการร้านทั่วไป */
  list(): Promise<Restaurant[]>;
  /** id ล้วน ๆ ไว้ให้จอรายการตัดสินว่าหัวใจดวงไหนทึบ โดยไม่ต้องดึงร้านซ้ำ */
  ids(): Promise<string[]>;
  /** กดซ้ำได้ไม่พัง จอที่ผู้ใช้กดรัว ๆ จึงไม่มีทางเห็น error ที่ไม่ได้แปลว่าอะไร */
  set(restaurantId: string, on: boolean): Promise<{ favorite: boolean }>;
}

export interface OrderRepo {
  create(input: CreateOrderInput): Promise<Order>;
  get(id: string): Promise<Order | null>;
  listForCustomer(customerId: string): Promise<Order[]>;
  /** เปลี่ยนสถานะออเดอร์ */
  updateStatus(
    id: string,
    status: OrderStatus,
    /** `deliveryPin`/`photoPath` หลักฐานตอนไรเดอร์ปิดงาน (design R11) */
    proof?: { deliveryPin?: string; photoPath?: string; reason?: CancelReason },
  ): Promise<Order>;
  /** ลูกค้าที่สั่งเงินสดไว้แล้วเงินไม่พอ กดจ่ายด้วยพร้อมเพย์แทน */
  payWithPromptPay(orderId: string): Promise<Order>;
  /** ทิปให้ไรเดอร์หลังส่งถึงแล้ว (design C11) เข้าไรเดอร์ 100% ไม่หักคอม */
  tip(orderId: string, amountSatang: number): Promise<Order>;
}

export type NewAddressInput = Omit<Address, 'id'>;

export interface AddressRepo {
  list(): Promise<Address[]>;
  add(input: NewAddressInput): Promise<Address>;
}

/** ฝั่งร้าน ทุกเมธอดตัดสินสิทธิ์จาก `restaurants.owner_user_id` ที่เซิร์ฟเวอร์ ไม่ใช่จาก account_type */
export interface MerchantRepo {
  myRestaurants(): Promise<MerchantRestaurant[]>;
  /** §4.3 "เปิดร้านของคุณ" ได้ร้านที่ยังไม่อนุมัติกลับมาเสมอ */
  registerRestaurant(
    input: RegisterRestaurantInput,
  ): Promise<MerchantRestaurant & {
    /** โซนที่พิกัดร้านตกอยู่ null = อยู่นอกโซนที่วาดไว้ ซึ่งเปิดร้านได้ตามปกติ */
    zoneName: string | null;
  }>;
  /** ส่งให้แอดมินตรวจ §7 ต้องมีเมนูตั้งต้นก่อน */
  submitForApproval(restaurantId: string): Promise<{ submitted: boolean }>;
  /** `queue` = ใบที่ครัวยังต้องทำต่อ `history` = ใบที่ออกจากมือร้านไปแล้ว */
  listOrders(opts?: { restaurantId?: string; scope?: 'queue' | 'history' }): Promise<MerchantOrder[]>;
  setOpen(restaurantId: string, isOpen: boolean): Promise<MerchantRestaurant>;
  /** ตารางเวลาเปิด-ปิด (design M11) ส่งครบเจ็ดวันทุกครั้ง ไม่ใช่ส่งเฉพาะวันที่แก้ */
  setHours(restaurantId: string, hours: WeeklyHours): Promise<MerchantRestaurant>;
  /** พักรับออเดอร์ตอนครัวล้นมือ `0` = กลับมารับเดี๋ยวนี้ เปิดกลับเองเมื่อครบเวลา */
  pause(restaurantId: string, minutes: number): Promise<MerchantRestaurant>;
  /** ที่ใช้บ่อยที่สุดคือกด "ของหมด" ระหว่างวัน ต้องมีผลกับการสั่งซื้อทันที */
  updateMenuItem(
    menuItemId: string,
    patch: { name?: string; description?: string; price?: number; isAvailable?: boolean },
  ): Promise<MenuItem>;
  /** ยอดขายวันนี้ / 7 วัน (design M1 M5) ไม่ระบุร้าน = รวมทุกร้านของบัญชีนี้ */
  summary(restaurantId?: string): Promise<MerchantSummary>;
  /** ยอดที่ร้านถอนได้ และใบที่ค้างอยู่ (§6.2) */
  payoutBalance(restaurantId: string): Promise<MerchantPayoutBalance>;
  payoutHistory(restaurantId: string): Promise<MerchantPayout[]>;
  /** ขอถอน ทีมงานเป็นคนอนุมัติ เงินถึงจะขยับ */
  requestPayout(restaurantId: string, amountSatang: number): Promise<MerchantPayout>;
}

/** ฝั่งไรเดอร์ (product-spec §6.3) */
export interface RiderRepo {
  status(): Promise<RiderStatus>;
  /** เปิดรับงานต้องส่งพิกัดมาด้วย ไม่รู้ว่าอยู่ไหนก็ให้คะแนนระยะทางไม่ได้ */
  setOnline(isOnline: boolean, at?: { lat: number; lng: number }): Promise<RiderStatus>;
  /** ส่งพิกัดระหว่างทาง product-spec §5 ทุก 3–5 วิ ตอนส่งของ / 15–30 วิ ตอนว่าง */
  ping(lat: number, lng: number): Promise<void>;
  jobs(): Promise<RiderJob[]>;
  acceptOffer(orderId: string): Promise<RiderJob>;
  declineOffer(orderId: string): Promise<void>;
  /** §8 North Star ตัวเลขไว้ให้ไรเดอร์ดูรายได้ ไม่ใช่กระดานแข่งอันดับ (§3 ข้อ 4) */
  stats(): Promise<{ hours: number; delivered: number; ordersPerHour: number | null }>;
  /** จอรายได้ + ประวัติงานตามช่วงที่เลือก ไม่ระบุ = สัปดาห์ (design R4 R6) */
  earnings(period?: EarningsPeriod): Promise<RiderEarnings>;
  /** เอกสารของตัวเอง (design R8) คืนครบทุกชนิดเสมอ ชนิดที่ยังไม่ส่งได้ `missing` */
  documents(): Promise<RiderDocument[]>;
  /** อัปโหลดเอกสารหนึ่งชนิด ส่งทับชนิดเดิมได้ */
  uploadDocument(
    kind: RiderDocumentKind,
    file: { uri: string; ext: string },
  ): Promise<RiderDocument>;
  /** อัปโหลดรูปยืนยันส่ง (design R11) คืนเส้นทางในบักเก็ตปิด */
  uploadDeliveryPhoto(orderId: string, file: { uri: string; ext: string }): Promise<string>;
  /** แจ้งปัญหาระหว่างส่ง (design R9) */
  reportIssue(input: {
    orderId: string;
    kind: RiderIssueKind;
    detail?: string;
  }): Promise<void>;
  /** โซนที่เปิดให้บริการ ตัวเลือกในใบสมัคร */
  zones(): Promise<Zone[]>;
  /** ใบสมัครของตัวเอง (R5) เรียกได้ตั้งแต่ยังไม่อนุมัติ ต่างจากเมธอดอื่นในนี้ */
  application(): Promise<RiderApplication>;
  submitApplication(input: RiderApplicationInput): Promise<RiderApplication>;
  /** ยอดเงินของไรเดอร์ (R12) รายได้ค้างจ่าย เงินสดในมือ และยอดถอนสุทธิ */
  /** จุดตั้งทำงาน (R7) `null` = ยังไม่ปักหมุด รับงานได้ทุกที่ */
  workBase(): Promise<RiderWorkBase | null>;
  setWorkBase(input: RiderWorkBase): Promise<RiderWorkBase | null>;
  balance(): Promise<RiderBalance>;
  /** ขอถอน ยังไม่มีเงินออกจนกว่าแอดมินจะกดยืนยัน (§6.4) */
  requestPayout(amountSatang: number): Promise<RiderPayout>;
}

export interface RefundRepo {
  /** ลูกค้าแจ้งปัญหา ระบบตรวจแล้วเก็บข้อเสนอไว้ ยังไม่มีเงินออกจนกว่าแอดมินจะกด (§6.4) */
  open(input: {
    orderId: string;
    reason: RefundReason;
    detail: string;
    hasPhoto?: boolean;
  }): Promise<RefundCase>;
  mine(): Promise<RefundCase[]>;
}

/** เฉพาะบัญชี admin เซิร์ฟเวอร์อ่าน account_type จากฐานทุกครั้ง ไม่เชื่อตั๋ว */
export interface AdminRepo {
  exceptions(): Promise<OrderException[]>;
  /** ตรวจเอกสารไรเดอร์ (design R8) ปฏิเสธต้องมีเหตุผลเสมอ */
  decideRiderDocument(
    accountId: string,
    kind: RiderDocumentKind,
    input: { approve: boolean; rejectionReason?: string },
  ): Promise<RiderDocument>;
  /** เคลียร์เรื่องที่ไรเดอร์แจ้งไว้แล้วจัดการเสร็จ (design R9) */
  resolveRiderIssue(issueId: string): Promise<void>;
  metrics(): Promise<AdminMetrics>;
  openRefunds(): Promise<RefundCase[]>;
  /** ไม่ส่งยอด/ความรับผิดมา = ใช้ตามที่ระบบเสนอ (§6.4 "ยืนยันด้วยการกดครั้งเดียว") */
  decideRefund(
    caseId: string,
    input: { approve: boolean; amountSatang?: number; fault?: RefundFault },
  ): Promise<RefundCase>;
  /** §6.3 ทางแทรกมือเมื่อระบบจ่ายงานไม่สำเร็จ */
  forceDispatch(orderId: string): Promise<{ offered: boolean; reason: string | null }>;
  pendingRestaurants(): Promise<PendingRestaurant[]>;
  decideRestaurant(restaurantId: string, approve: boolean): Promise<MerchantRestaurant>;
  /** คิวอนุมัติไรเดอร์ (§7) ปฏิเสธต้องมีเหตุผล ไม่งั้นไรเดอร์ไม่รู้ว่าต้องแก้อะไร */
  pendingRiders(): Promise<PendingRider[]>;
  decideRider(
    accountId: string,
    input: { approve: boolean; rejectionReason?: string },
  ): Promise<RiderApplication>;
  /** บันทึกว่าไรเดอร์นำเงินสดมาส่งแล้ว (§6.2) */
  settleRiderCash(accountId: string, amountSatang: number): Promise<CashSettlement>;
  /** ไรเดอร์ที่ยังถือเงินสดของบริษัทอยู่ */
  ridersHoldingCash(): Promise<RiderCashHolder[]>;
  /** คำขอถอนที่รอตัดสิน (design R12) ไรเดอร์ขอ แอดมินยืนยัน ไม่มีรอบจ่ายอัตโนมัติ (§10) */
  riderPayouts(): Promise<PendingRiderPayout[]>;
  /** ยืนยันหรือปฏิเสธคำขอถอน ปฏิเสธต้องบอกเหตุผล */
  /** คำขอถอนของร้านที่รอทีมงานตัดสิน (§6.2) */
  merchantPayouts(): Promise<PendingMerchantPayout[]>;
  decideMerchantPayout(
    payoutId: string,
    input: { approve: boolean; rejectionReason?: string },
  ): Promise<MerchantPayout>;
  decideRiderPayout(
    payoutId: string,
    input: { approve: boolean; rejectionReason?: string },
  ): Promise<RiderPayout>;

  /** จอเฝ้าออเดอร์ (design AD2) ตัวกรองสามค่า นิยามอยู่ฝั่งเซิร์ฟเวอร์ */
  orders(filter: AdminOrderFilter): Promise<AdminOrderRow[]>;
  /** ตัวเลขสดของ AD1 "ตอนนี้เกิดอะไรขึ้น" ไม่ใช่ "เดือนที่แล้วเป็นไง" */
  liveOps(): Promise<LiveOps>;
  /** ยอดค้างจ่ายรายร้าน (design AD7) อ่านจาก ledger ไม่ใช่คำนวณใหม่จาก orders */
  restaurantPayables(): Promise<RestaurantPayable[]>;
  /** จ่ายยอดค้างทั้งก้อนของร้านหนึ่ง ไม่มีปุ่มจ่ายทุกร้าน (§2 ยังห้ามรอบจ่ายอัตโนมัติ) */
  settleRestaurant(restaurantId: string): Promise<{ paidSatang: number }>;
  /** หมุดไรเดอร์ + หมุดออเดอร์ที่ยังวิ่ง (design AD8) */
  opsMap(): Promise<OpsMapData>;
  /** เอกสาร KYC พร้อมลิงก์ดูรูป (design AD6) ลิงก์เซ็นชื่อ อายุสั้น */
  riderDocuments(accountId: string): Promise<RiderDocumentWithUrl[]>;

  /** คิวตั๋วซัพพอร์ตทั้งระบบ (design AD4) ไม่ส่ง status = เอาทั้งหมด */
  tickets(status?: TicketStatus): Promise<SupportTicket[]>;
  /** ปิดตั๋ว แอดมินเท่านั้น ลูกค้าปิดเองได้จะทำให้เรื่องที่ยังไม่จบหายจากคิว */
  closeTicket(ticketId: string): Promise<void>;
}

/** แชทของออเดอร์ (design C10 M10) แบบเดียวกับ Grab / LINE MAN */
export interface ChatRepo {
  thread(orderId: string, channel: ChatChannel): Promise<ChatThread>;
  send(orderId: string, channel: ChatChannel, body: string): Promise<void>;
}

/** ฟอร์มเขียนรีวิว (design C11) */
export interface WriteReviewInput {
  restaurantRating: number;
  /** ไม่ให้คะแนนไรเดอร์ก็ได้ ใบที่วางไว้หน้าประตูลูกค้าไม่ได้เจอเขาเลย */
  riderRating?: number | null;
  comment?: string | null;
  /** เส้นทางที่อัปขึ้น `public-media` ไว้ก่อนแล้ว สูงสุด 4 รูปตามช่องบนจอ C36 */
  photoPaths?: string[];
}

/** รีวิว (design C11 C36 M9) */
export interface ReviewRepo {
  write(orderId: string, input: WriteReviewInput): Promise<Review>;
  /** จอ C11 เช็คก่อนว่าใบนี้รีวิวไปแล้วหรือยัง จะได้ไม่โชว์ฟอร์มซ้ำ null = ยังไม่รีวิว */
  forOrder(orderId: string): Promise<Review | null>;
  /** อ่านได้โดยไม่ต้องล็อกอิน เหมือนรายชื่อร้านและเมนู (design C36) */
  forRestaurant(restaurantId: string): Promise<ReviewSummary>;
  /** รีวิวที่ร้านของฉันได้รับ (design M9) */
  forMyRestaurant(restaurantId: string): Promise<ReviewSummary>;
}

/** ฟอร์มเปิดตั๋ว (design AD4) `orderId` ไม่บังคับ เรื่องบัญชีไม่ได้ผูกกับใบไหน */
export interface OpenTicketInput {
  orderId?: string;
  kind: TicketKind;
  subject: string;
  body: string;
}

/** ตั๋วซัพพอร์ตฝั่งผู้ใช้ (design AD4) */
export interface SupportRepo {
  open(input: OpenTicketInput): Promise<{ id: string }>;
  mine(): Promise<SupportTicket[]>;
  /** เธรด เจ้าของตั๋วกับผู้ดูแลระบบเท่านั้นที่อ่านได้ (เซิร์ฟเวอร์เป็นคนบังคับ) */
  thread(ticketId: string): Promise<SupportThread>;
  reply(ticketId: string, body: string): Promise<void>;
}

/** เฉพาะบัญชี `super_admin` (design SA1–SA6) */
export interface SuperRepo {
  /** ตัวเลข §8 ครบเก้าตัว (design SA1) หน้าต่างเวลาเป็นวัน ตั้งต้น 30 */
  metrics(days?: number): Promise<AdminMetrics>;
  /** โซนพร้อมตัวเลขรายโซน ไม่มีสวิตช์ปิดโซน เพราะโซนไม่ได้กั้นอะไรแล้ว */
  zones(): Promise<ZoneReport[]>;
  createZone(input: ZoneInput): Promise<ZoneReport>;
  updateZone(id: string, input: ZoneInput): Promise<ZoneReport>;
  /** บัญชีที่เป็นผู้ดูแลระบบทั้งหมด (design SA3) */
  admins(): Promise<AdminAccountRow[]>;
  /** ให้/ถอนสิทธิ์ผู้ดูแลระบบ ถอนของตัวเองไม่ได้ */
  setRole(accountId: string, role: AccountType): Promise<{ accountId: string; role: AccountType }>;
  /** ยกบัญชีที่ยังไม่ใช่แอดมินขึ้นมา ค้นด้วยชื่อผู้ใช้เพราะจอลิสต์เฉพาะคนที่เป็นแอดมินอยู่แล้ว */
  grantAdmin(username: string, role: AccountType): Promise<{ accountId: string; role: AccountType }>;
  /** สร้างบัญชีผู้ดูแลระบบใหม่ ทางสมัครปกติสร้าง admin ไม่ได้ */
  createAdmin(input: {
    username: string; fullName: string; phone: string; password: string; role: AccountType;
  }): Promise<{ accountId: string; role: AccountType }>;
  /** SA4 กับ SA6 อยู่จอเดียวกัน จึงอ่านมาด้วยกันครั้งเดียว */
  config(): Promise<SuperConfig>;
  /** เปลี่ยนราคา เซิร์ฟเวอร์เขียน audit ในทรานแซกชันเดียวกันเสมอ (product-spec §6.1) */
  setPricing(input: Omit<PlatformPricing, 'updatedAt'>): Promise<PlatformPricing>;
  setFlag(key: FeatureFlagKey, enabled: boolean): Promise<{ key: FeatureFlagKey; enabled: boolean }>;
  /** ประวัติการกระทำ (design SA5) อ่านอย่างเดียว ไม่มีเมธอดแก้หรือลบ และต้องไม่มีตลอดไป */
  audit(action?: string): Promise<AuditRow[]>;
}

/** ค่าที่แอปต้องรู้ก่อนวาดจอ เรียกได้ตั้งแต่ยังไม่ล็อกอิน */
export interface ConfigRepo {
  get(): Promise<PlatformConfig>;
}

export interface Repos {
  config: ConfigRepo;
  auth: AuthRepo;
  catalog: CatalogRepo;
  favorites: FavoritesRepo;
  orders: OrderRepo;
  addresses: AddressRepo;
  merchant: MerchantRepo;
  rider: RiderRepo;
  refunds: RefundRepo;
  support: SupportRepo;
  reviews: ReviewRepo;
  chat: ChatRepo;
  admin: AdminRepo;
  super: SuperRepo;
}
