import type {
  Account, AccountType, Address, MenuItem, MerchantOrder, MerchantRestaurant,
  Order, OrderStatus, PaymentMethod, Restaurant,
} from '../types';

export interface RegisterInput {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  accountType: AccountType;
  /** ช่องทางรีเซ็ตรหัสผ่านเท่านั้น ไม่ใช่ identifier สำหรับล็อกอิน (claude.md §4.2) */
  email?: string;
  /** ตั๋วจาก verifyOtp — พิสูจน์ว่าเบอร์นี้ยืนยันแล้ว */
  verificationToken: string;
}

/** ฟอร์มสั้นหลังผ่าน Google — ไม่มีรหัสผ่าน เพราะเข้าด้วยบัญชี Google */
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

/**
 * แอปส่งมาแค่ "อยากได้อะไร" — **ไม่ส่งราคา**
 * เซิร์ฟเวอร์ตีราคาจากเมนูในฐานเอง ไม่งั้นแอปที่ถูกแก้จะสั่งของแพงในราคาถูกได้
 * และคอมมิชชัน 15% (claude.md §6.1) จะคิดจากยอดปลอมนั้น
 */
export interface CreateOrderInput {
  restaurantId: string;
  items: { menuItemId: string; quantity: number; choiceIds: string[] }[];
  paymentMethod: PaymentMethod;
  /** ไม่ระบุ = ใช้ที่อยู่แรกที่บันทึกไว้ */
  deliveryAddressId?: string;
}

export interface AuthRepo {
  /** identifier รับได้ทั้ง username หรือเบอร์โทร — อีเมลใช้ล็อกอินไม่ได้ (claude.md §4.2) */
  login(identifier: string, password: string): Promise<Account>;
  /** ขอรหัส OTP · `devCode` มีเฉพาะตอนเซิร์ฟเวอร์ไม่ใช่ production (ยังไม่มีผู้ให้บริการ SMS) */
  requestOtp(phone: string): Promise<{ devCode?: string }>;
  /** ตรวจรหัสแล้วคืนตั๋วยืนยันเบอร์ ที่ต้องยื่นตอนสมัคร */
  verifyOtp(phone: string, code: string): Promise<string>;
  register(input: RegisterInput): Promise<Account>;
  /** ขั้นแรกของ Google sign-in — Google ไม่ทดแทน OTP คนใหม่ยังต้องยืนยันเบอร์ */
  googleSignIn(idToken: string): Promise<GoogleSignInResult>;
  googleRegister(input: GoogleRegisterInput): Promise<Account>;
  /** เปิดแอปมาแล้วยังมีเซสชันค้างอยู่ไหม — null = ต้องล็อกอินใหม่ */
  restore(): Promise<Account | null>;
  logout(): Promise<void>;
}

/** ข้อมูลเมนูใหม่จากหน้าเพิ่มเมนูของร้าน (ยังไม่มี id — repo เป็นคนตั้ง) */
export type NewMenuItemInput = Omit<MenuItem, 'id'>;

export interface CatalogRepo {
  listRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;
  getMenu(restaurantId: string): Promise<MenuItem[]>;
  createMenuItem(input: NewMenuItemInput): Promise<MenuItem>;
  /**
   * ค้นร้านจากชื่อร้าน "หรือ" ชื่อเมนูในร้านนั้น (design C2: "ค้นหาร้านหรือเมนู")
   * ทำที่ชั้น repo ไม่ใช่ในจอ เพราะของจริงต้องค้นฝั่ง backend — จอไม่ควรดึงเมนูทุกร้านมาไว้ในเครื่อง
   */
  searchRestaurants(query: string): Promise<Restaurant[]>;
}

export interface OrderRepo {
  create(input: CreateOrderInput): Promise<Order>;
  get(id: string): Promise<Order | null>;
  listForCustomer(customerId: string): Promise<Order[]>;
  updateStatus(id: string, status: OrderStatus): Promise<Order>;
  /**
   * ลูกค้าที่สั่งเงินสดไว้แล้วเงินไม่พอ กดจ่ายด้วยพร้อมเพย์แทน
   * เงินเข้าแพลตฟอร์มโดยตรง ไรเดอร์ไม่ต้องออกเงินและไม่ต้องเก็บเงินสดใบนี้อีก
   * เงื่อนไขว่าเปลี่ยนได้เมื่อไหร่อยู่ที่ `canPayNowWithPromptPay` ใน src/lib/rules.ts
   */
  payWithPromptPay(orderId: string): Promise<Order>;
}

export type NewAddressInput = Omit<Address, 'id'>;

export interface AddressRepo {
  list(): Promise<Address[]>;
  add(input: NewAddressInput): Promise<Address>;
}

/**
 * ฝั่งร้าน — ทุกเมธอดตัดสินสิทธิ์จาก `restaurants.owner_user_id` ที่เซิร์ฟเวอร์ ไม่ใช่จาก account_type
 * เพราะร้านเป็น "ความสามารถ" บนบัญชี type `user` ไม่ใช่ประเภทบัญชี (claude.md §4.3)
 */
export interface MerchantRepo {
  myRestaurants(): Promise<MerchantRestaurant[]>;
  /** `queue` = ใบที่ครัวยังต้องทำต่อ · `history` = ใบที่ออกจากมือร้านไปแล้ว */
  listOrders(opts?: { restaurantId?: string; scope?: 'queue' | 'history' }): Promise<MerchantOrder[]>;
  setOpen(restaurantId: string, isOpen: boolean): Promise<MerchantRestaurant>;
  /** ที่ใช้บ่อยที่สุดคือกด "ของหมด" ระหว่างวัน — ต้องมีผลกับการสั่งซื้อทันที */
  updateMenuItem(
    menuItemId: string,
    patch: { name?: string; description?: string; price?: number; isAvailable?: boolean },
  ): Promise<MenuItem>;
}

export interface Repos {
  auth: AuthRepo;
  catalog: CatalogRepo;
  orders: OrderRepo;
  addresses: AddressRepo;
  merchant: MerchantRepo;
}
