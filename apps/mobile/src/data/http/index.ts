import type {
  Repos, RegisterInput, GoogleRegisterInput, GoogleSignInResult,
  CreateOrderInput, NewMenuItemInput, NewAddressInput, RegisterRestaurantInput,
} from '../repositories';
import type {
  Account, Address, MenuItem, MerchantOrder, MerchantRestaurant, Order, OrderStatus,
  Restaurant, RiderJob, RiderStatus, RiderEarnings, RefundCase, OrderException, AdminMetrics,
  PendingRestaurant, MerchantSummary,
} from '../types';
import { createClient, ApiError } from './client';
import type { TokenStore } from './tokenStore';

export { ApiError } from './client';

/** สิ่งที่ /auth/* ตอบกลับตอนล็อกอินหรือสมัครสำเร็จ */
type AuthOk = { token: string; account: Account };

/**
 * รีโปที่คุยกับ core-api จริง — คู่กับ createMockRepos ตัวต่อตัว
 *
 * จอไม่เคยรู้ว่าอยู่โหมดไหน เพราะทั้งสองตัว implement interface เดียวกัน (claude.md §9)
 * การสลับจึงเป็นการแก้ไฟล์เดียวที่ src/data/index.ts
 */
export function createHttpRepos(baseUrl: string, session: TokenStore): Repos {
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

      async createMenuItem(input: NewMenuItemInput): Promise<MenuItem> {
        // อยู่ใต้ /merchant เพราะเซิร์ฟเวอร์ต้องเช็คว่าเป็นเจ้าของร้านนี้จริงก่อน
        // แต่คงไว้ใน catalog repo เพื่อไม่ให้จอเพิ่มเมนูที่มีอยู่ต้องแก้ตาม
        return request<MenuItem>('/merchant/menu', { method: 'POST', body: input, token: auth() });
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

    merchant: {
      async myRestaurants(): Promise<MerchantRestaurant[]> {
        return request<MerchantRestaurant[]>('/merchant/restaurants', { token: auth() });
      },

      async registerRestaurant(input: RegisterRestaurantInput) {
        return request<MerchantRestaurant & { zoneName: string }>('/merchant/restaurants', {
          method: 'POST', body: input, token: auth(),
        });
      },

      async submitForApproval(restaurantId) {
        return request<{ submitted: boolean }>(`/merchant/restaurants/${restaurantId}/submit`, {
          method: 'POST', token: auth(),
        });
      },

      async listOrders(opts): Promise<MerchantOrder[]> {
        const q = new URLSearchParams({ scope: opts?.scope ?? 'queue' });
        if (opts?.restaurantId) q.set('restaurantId', opts.restaurantId);
        return request<MerchantOrder[]>(`/merchant/orders?${q}`, { token: auth() });
      },

      async setOpen(restaurantId, isOpen): Promise<MerchantRestaurant> {
        return request<MerchantRestaurant>(`/merchant/restaurants/${restaurantId}/open`, {
          method: 'PATCH',
          body: { isOpen },
          token: auth(),
        });
      },

      async updateMenuItem(menuItemId, patch): Promise<MenuItem> {
        return request<MenuItem>(`/merchant/menu/${menuItemId}`, {
          method: 'PATCH',
          body: patch,
          token: auth(),
        });
      },

      async summary(restaurantId): Promise<MerchantSummary> {
        const q = restaurantId ? `?restaurantId=${restaurantId}` : '';
        return request<MerchantSummary>(`/merchant/summary${q}`, { token: auth() });
      },
    },

    rider: {
      async status(): Promise<RiderStatus> {
        return request<RiderStatus>('/rider/status', { token: auth() });
      },

      async setOnline(isOnline, at): Promise<RiderStatus> {
        return request<RiderStatus>('/rider/online', {
          method: 'POST',
          body: { isOnline, ...(at ?? {}) },
          token: auth(),
        });
      },

      async ping(lat, lng): Promise<void> {
        await request('/rider/ping', { method: 'POST', body: { lat, lng }, token: auth() });
      },

      async jobs(): Promise<RiderJob[]> {
        return request<RiderJob[]>('/rider/jobs', { token: auth() });
      },

      async acceptOffer(orderId): Promise<RiderJob> {
        return request<RiderJob>(`/rider/jobs/${orderId}/accept`, { method: 'POST', token: auth() });
      },

      async declineOffer(orderId): Promise<void> {
        await request(`/rider/jobs/${orderId}/decline`, { method: 'POST', token: auth() });
      },

      async stats() {
        return request<{ hours: number; delivered: number; ordersPerHour: number | null }>(
          '/rider/stats',
          { token: auth() },
        );
      },

      async earnings(): Promise<RiderEarnings> {
        return request<RiderEarnings>('/rider/earnings', { token: auth() });
      },
    },

    refunds: {
      async open(input): Promise<RefundCase> {
        return request<RefundCase>('/refunds', { method: 'POST', body: input, token: auth() });
      },
      async mine(): Promise<RefundCase[]> {
        return request<RefundCase[]>('/refunds', { token: auth() });
      },
    },

    admin: {
      async exceptions(): Promise<OrderException[]> {
        return request<OrderException[]>('/admin/exceptions', { token: auth() });
      },
      async metrics(): Promise<AdminMetrics> {
        return request<AdminMetrics>('/admin/metrics', { token: auth() });
      },
      async openRefunds(): Promise<RefundCase[]> {
        return request<RefundCase[]>('/admin/refunds', { token: auth() });
      },
      async decideRefund(caseId, input): Promise<RefundCase> {
        return request<RefundCase>(`/admin/refunds/${caseId}`, {
          method: 'POST', body: input, token: auth(),
        });
      },
      async forceDispatch(orderId) {
        return request<{ offered: boolean; reason: string | null }>(
          `/admin/dispatch/orders/${orderId}`,
          { method: 'POST', token: auth() },
        );
      },

      async pendingRestaurants(): Promise<PendingRestaurant[]> {
        return request<PendingRestaurant[]>('/admin/restaurants/pending', { token: auth() });
      },

      async decideRestaurant(restaurantId, approve): Promise<MerchantRestaurant> {
        return request<MerchantRestaurant>(`/admin/restaurants/${restaurantId}/approval`, {
          method: 'POST', body: { approve }, token: auth(),
        });
      },
    },
  };
}
