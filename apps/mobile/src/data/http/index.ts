import type {
  Repos, RegisterInput, GoogleRegisterInput, GoogleSignInResult,
  CreateOrderInput, NewMenuItemInput, NewAddressInput,
} from '../repositories';
import type { Account, Address, MenuItem, Order, OrderStatus, Restaurant } from '../types';
import { createClient, ApiError } from './client';
import { session } from './session';

export { ApiError } from './client';

/** สิ่งที่ /auth/* ตอบกลับตอนล็อกอินหรือสมัครสำเร็จ */
type AuthOk = { token: string; account: Account };

/**
 * รีโปที่คุยกับ core-api จริง — คู่กับ createMockRepos ตัวต่อตัว
 *
 * จอไม่เคยรู้ว่าอยู่โหมดไหน เพราะทั้งสองตัว implement interface เดียวกัน (claude.md §9)
 * การสลับจึงเป็นการแก้ไฟล์เดียวที่ src/data/index.ts
 */
export function createHttpRepos(baseUrl: string): Repos {
  const request = createClient(baseUrl);
  const auth = () => session.get();

  /** เก็บ token แล้วคืน account — ใช้ซ้ำทุกทางที่ล็อกอินสำเร็จ */
  async function acceptSession(res: AuthOk): Promise<Account> {
    await session.set(res.token);
    return res.account;
  }

  return {
    auth: {
      async login(identifier, password) {
        return acceptSession(
          await request<AuthOk>('/auth/login', { method: 'POST', body: { identifier, password } }),
        );
      },

      async requestOtp(phone) {
        return request<{ devCode?: string }>('/auth/otp/request', {
          method: 'POST',
          body: { phone },
        });
      },

      async verifyOtp(phone, code) {
        const res = await request<{ verificationToken: string }>('/auth/otp/verify', {
          method: 'POST',
          body: { phone, code },
        });
        return res.verificationToken;
      },

      async register(input: RegisterInput) {
        return acceptSession(await request<AuthOk>('/auth/register', { method: 'POST', body: input }));
      },

      async googleSignIn(idToken): Promise<GoogleSignInResult> {
        const res = await request<
          | ({ needsRegistration: false } & AuthOk)
          | {
              needsRegistration: true;
              googleToken: string;
              prefill: { email: string | null; fullName: string | null };
            }
        >('/auth/google', { method: 'POST', body: { idToken } });

        if (res.needsRegistration) return res;
        return { needsRegistration: false, account: await acceptSession(res) };
      },

      async googleRegister(input: GoogleRegisterInput) {
        return acceptSession(
          await request<AuthOk>('/auth/google/register', { method: 'POST', body: input }),
        );
      },

      async restore() {
        const token = await session.load();
        if (!token) return null;
        try {
          return await request<Account>('/auth/me', { token });
        } catch (error) {
          // token หมดอายุหรือบัญชีถูกปิด — ล้างทิ้งแล้วให้ล็อกอินใหม่
          // ถ้าเน็ตหลุด (status 0) เก็บ token ไว้ เพราะยังไม่รู้ว่ามันใช้ไม่ได้จริง
          if (error instanceof ApiError && error.status === 401) await session.clear();
          return null;
        }
      },

      async logout() {
        await session.clear();
      },
    },

    catalog: {
      async listRestaurants(): Promise<Restaurant[]> {
        return request<Restaurant[]>('/catalog/restaurants', { token: auth() });
      },

      async getRestaurant(id): Promise<Restaurant | null> {
        try {
          return await request<Restaurant>(`/catalog/restaurants/${id}`, { token: auth() });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }
      },

      async getMenu(restaurantId): Promise<MenuItem[]> {
        return request<MenuItem[]>(`/catalog/restaurants/${restaurantId}/menu`, { token: auth() });
      },

      async searchRestaurants(query): Promise<Restaurant[]> {
        return request<Restaurant[]>(`/catalog/restaurants?q=${encodeURIComponent(query)}`, {
          token: auth(),
        });
      },

      async createMenuItem(_input: NewMenuItemInput): Promise<MenuItem> {
        // ฝั่งร้านยังไม่มี endpoint (คลื่นที่ 3) — โยนให้ชัดดีกว่าเงียบแล้วให้จอคิดว่าสำเร็จ
        throw new ApiError(501, 'เพิ่มเมนูผ่านเซิร์ฟเวอร์ยังไม่พร้อมใช้งาน');
      },
    },

    orders: {
      async create(input: CreateOrderInput): Promise<Order> {
        return request<Order>('/orders', { method: 'POST', body: input, token: auth() });
      },

      async get(id): Promise<Order | null> {
        try {
          return await request<Order>(`/orders/${id}`, { token: auth() });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }
      },

      async listForCustomer(_customerId): Promise<Order[]> {
        // เซิร์ฟเวอร์รู้ว่าใครถามจาก token อยู่แล้ว จึงไม่ส่ง customerId ไปให้ปลอมได้
        return request<Order[]>('/orders', { token: auth() });
      },

      async updateStatus(id, status: OrderStatus): Promise<Order> {
        return request<Order>(`/orders/${id}/status`, {
          method: 'PATCH',
          body: { status },
          token: auth(),
        });
      },

      async payWithPromptPay(orderId): Promise<Order> {
        return request<Order>(`/orders/${orderId}/pay-promptpay`, {
          method: 'POST',
          token: auth(),
        });
      },
    },

    addresses: {
      async list(): Promise<Address[]> {
        return request<Address[]>('/addresses', { token: auth() });
      },

      async add(input: NewAddressInput): Promise<Address> {
        return request<Address>('/addresses', { method: 'POST', body: input, token: auth() });
      },
    },
  };
}
