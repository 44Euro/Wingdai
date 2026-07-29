import type { Account, AccountType, MenuItem, Order, OrderItem, OrderStatus, Restaurant } from '../types';

export interface RegisterInput {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  accountType: AccountType;
  /** login alias เสริม — optional เสมอ ไม่ต้อง OTP-verify */
  email?: string;
}

export interface CreateOrderInput {
  customerId: string;
  restaurantId: string;
  items: OrderItem[];
  deliveryFee: number;
  serviceFee: number;
}

export interface AuthRepo {
  /** identifier รับได้ทั้ง username หรือเบอร์โทร — อีเมลใช้ล็อกอินไม่ได้ เป็นแค่ช่องทางรีเซ็ตรหัส (claude.md §4.2) */
  login(identifier: string, password: string): Promise<Account>;
  register(input: RegisterInput): Promise<Account>;
  verifyOtp(accountId: string, code: string): Promise<boolean>;
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
}

export interface Repos {
  auth: AuthRepo;
  catalog: CatalogRepo;
  orders: OrderRepo;
}
