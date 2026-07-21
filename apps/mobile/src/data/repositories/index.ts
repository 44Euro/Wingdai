import type { Account, AccountType, Order, OrderItem, OrderStatus, Restaurant } from '../types';

export interface RegisterInput {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  accountType: AccountType;
}

export interface CreateOrderInput {
  customerId: string;
  restaurantId: string;
  items: OrderItem[];
  deliveryFee: number;
  serviceFee: number;
}

export interface AuthRepo {
  login(username: string, password: string): Promise<Account>;
  register(input: RegisterInput): Promise<Account>;
  verifyOtp(accountId: string, code: string): Promise<boolean>;
  logout(): Promise<void>;
}

export interface CatalogRepo {
  listRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;
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
