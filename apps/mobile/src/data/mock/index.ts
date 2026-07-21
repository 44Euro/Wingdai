import type { Repos, RegisterInput, CreateOrderInput } from '../repositories';
import type { Account, Order, Restaurant } from '../types';
import { assertTransition } from '../orderStateMachine';
import { seedAccounts, seedRestaurants, MOCK_PASSWORD } from './seed';

export function createMockRepos(): Repos {
  // state แยกต่อ instance เพื่อให้เทสต์ไม่รบกวนกัน
  const accounts: Account[] = seedAccounts.map((a) => ({ ...a }));
  const restaurants: Restaurant[] = seedRestaurants.map((r) => ({ ...r }));
  const orders: Order[] = [];
  let seq = 0;

  const delay = () => new Promise<void>((r) => setTimeout(r, 0));

  return {
    auth: {
      async login(username, password) {
        await delay();
        const acc = accounts.find((a) => a.username === username);
        if (!acc || password !== MOCK_PASSWORD) {
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        return { ...acc };
      },
      async register(input: RegisterInput) {
        await delay();
        if (accounts.some((a) => a.username === input.username)) {
          throw new Error('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
        }
        const acc: Account = {
          id: `u-${++seq}`,
          accountType: input.accountType,
          username: input.username,
          fullName: input.fullName,
          phone: input.phone,
          ownedRestaurantIds: [],
          ...(input.accountType === 'rider' ? { riderApproval: 'pending' as const } : {}),
        };
        accounts.push(acc);
        return { ...acc };
      },
      async verifyOtp(_accountId, code) {
        await delay();
        return code === '123456';
      },
      async logout() {
        await delay();
      },
    },

    catalog: {
      async listRestaurants() {
        await delay();
        return restaurants.map((r) => ({ ...r }));
      },
      async getRestaurant(id) {
        await delay();
        const r = restaurants.find((x) => x.id === id);
        return r ? { ...r } : null;
      },
    },

    orders: {
      async create(input: CreateOrderInput) {
        await delay();
        const foodTotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const order: Order = {
          id: `o-${++seq}`,
          customerId: input.customerId,
          restaurantId: input.restaurantId,
          status: 'created',
          items: input.items.map((i) => ({ ...i })),
          foodTotal,
          deliveryFee: input.deliveryFee,
          serviceFee: input.serviceFee,
          createdAt: new Date().toISOString(),
        };
        orders.push(order);
        return { ...order };
      },
      async get(id) {
        await delay();
        const o = orders.find((x) => x.id === id);
        return o ? { ...o } : null;
      },
      async listForCustomer(customerId) {
        await delay();
        return orders.filter((o) => o.customerId === customerId).map((o) => ({ ...o }));
      },
      async updateStatus(id, status) {
        await delay();
        const o = orders.find((x) => x.id === id);
        if (!o) throw new Error(`ไม่พบออร์เดอร์ ${id}`);
        assertTransition(o.status, status); // โยน InvalidTransitionError ถ้าข้ามขั้น
        o.status = status;
        return { ...o };
      },
    },
  };
}
