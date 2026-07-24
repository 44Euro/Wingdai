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
  /** identifier รับได้ทั้ง username หรือ email — อีเมลเป็น login alias เสริม ไม่ใช่ verified channel ตาม claude.md §4.2 */
  login(identifier: string, password: string): Promise<Account>;
  register(input: RegisterInput): Promise<Account>;
  verifyOtp(accountId: string, code: string): Promise<boolean>;
  logout(): Promise<void>;
}

export interface CatalogRepo {
  listRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;
  getMenu(restaurantId: string): Promise<MenuItem[]>;
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
