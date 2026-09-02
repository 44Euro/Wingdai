import type {
  Repos, RegisterInput, GoogleRegisterInput, GoogleSignInResult,
  CreateOrderInput, NewMenuItemInput, NewAddressInput, RegisterRestaurantInput,
} from '../repositories';
import type {
  Account, Address, MenuItem, MerchantOrder, MerchantRestaurant, Order, OrderStatus,
  Restaurant, RiderJob, RiderStatus, RiderEarnings, RefundCase, OrderException, AdminMetrics,
  PendingRestaurant, MerchantSummary, MerchantPayout, MerchantPayoutBalance,
  PendingMerchantPayout,
  Zone, RiderApplication, PendingRider,
  CashSettlement, RiderCashHolder, PendingRiderPayout, RiderBalance, RiderPayout, RiderWorkBase,
  EarningsPeriod, RiderDocument, RiderDocumentKind,
  AdminOrderRow, LiveOps, RestaurantPayable, OpsMapData, RiderDocumentWithUrl,
  PlatformConfig, AccountType, ZoneReport, AdminAccountRow, FeatureFlagKey, PlatformPricing,
  SuperConfig, AuditRow, SupportTicket, SupportThread, Review, ReviewSummary, ChatChannel, ChatThread,
} from '../types';
import { createClient, ApiError } from './client';
import type { TokenStore } from './tokenStore';

export { ApiError } from './client';

/** สิ่งที่ /auth/* ตอบกลับตอนล็อกอินหรือสมัครสำเร็จ */
type AuthOk = { token: string; account: Account };

/** รีโปที่คุยกับ core-api จริง คู่กับ createMockRepos ตัวต่อตัว */
export function createHttpRepos(baseUrl: string, session: TokenStore): Repos {
  const request = createClient(baseUrl);
  const auth = () => session.get();

  /** เก็บ token แล้วคืน account ใช้ซ้ำทุกทางที่ล็อกอินสำเร็จ */
  async function acceptSession(res: AuthOk): Promise<Account> {
    await session.set(res.token);
    return res.account;
  }

  return {
    config: {
      /** ไม่แนบ token จอสมัครสมาชิกต้องอ่านค่านี้ได้ตั้งแต่ยังไม่มีบัญชี */
      async get(): Promise<PlatformConfig> {
        return request<PlatformConfig>('/config');
      },
    },

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
          // token หมดอายุหรือบัญชีถูกปิด ล้างทิ้งแล้วให้ล็อกอินใหม่
          if (error instanceof ApiError && error.status === 401) await session.clear();
          return null;
        }
      },

      async logout() {
        await session.clear();
      },

      async updateProfile(input): Promise<Account> {
        return request<Account>('/auth/me', {
          method: 'PATCH',
          // อีเมลว่างส่งเป็นสตริงว่าง = สั่งลบ ไม่ใช่ "ไม่แก้"
          body: { fullName: input.fullName, email: input.email ?? '' },
          token: auth(),
        });
      },

      async changePassword(input): Promise<Account> {
        return request<Account>('/auth/me/password', {
          method: 'POST', body: input, token: auth(),
        });
      },

      async changePhone(input): Promise<Account> {
        return request<Account>('/auth/me/phone', {
          method: 'PATCH', body: input, token: auth(),
        });
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

      async updateStatus(id, status: OrderStatus, proof): Promise<Order> {
        return request<Order>(`/orders/${id}/status`, {
          method: 'PATCH',
          body: { status, ...(proof ?? {}) },
          token: auth(),
        });
      },

      async tip(orderId, amountSatang): Promise<Order> {
        return request<Order>(`/orders/${orderId}/tip`, {
          method: 'POST', body: { amountSatang }, token: auth(),
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

    favorites: {
      async list(): Promise<Restaurant[]> {
        return request<Restaurant[]>('/favorites', { token: auth() });
      },
      async ids(): Promise<string[]> {
        return request<string[]>('/favorites/ids', { token: auth() });
      },
      async set(restaurantId, on): Promise<{ favorite: boolean }> {
        return request<{ favorite: boolean }>(`/favorites/${restaurantId}`, {
          method: on ? 'POST' : 'DELETE', token: auth(),
        });
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

      async setHours(restaurantId, hours): Promise<MerchantRestaurant> {
        return request<MerchantRestaurant>(`/merchant/restaurants/${restaurantId}/hours`, {
          method: 'PATCH', body: { hours }, token: auth(),
        });
      },
      async pause(restaurantId, minutes): Promise<MerchantRestaurant> {
        return request<MerchantRestaurant>(`/merchant/restaurants/${restaurantId}/pause`, {
          method: 'POST', body: { minutes }, token: auth(),
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

      async payoutBalance(restaurantId): Promise<MerchantPayoutBalance> {
        return request<MerchantPayoutBalance>(
          `/merchant/restaurants/${restaurantId}/payout`, { token: auth() },
        );
      },

      async payoutHistory(restaurantId): Promise<MerchantPayout[]> {
        return request<MerchantPayout[]>(
          `/merchant/restaurants/${restaurantId}/payout/history`, { token: auth() },
        );
      },

      async requestPayout(restaurantId, amountSatang): Promise<MerchantPayout> {
        return request<MerchantPayout>(`/merchant/restaurants/${restaurantId}/payout`, {
          method: 'POST',
          body: { amountSatang },
          token: auth(),
        });
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

      async earnings(period = 'week' as EarningsPeriod): Promise<RiderEarnings> {
        return request<RiderEarnings>(`/rider/earnings?period=${period}`, { token: auth() });
      },

      async documents(): Promise<RiderDocument[]> {
        return request<RiderDocument[]>('/rider/documents', { token: auth() });
      },

      /** สามขั้นตามที่ §5 กำหนดไว้ว่าคีย์ Storage ห้ามออกจากเซิร์ฟเวอร์: */
      async uploadDocument(kind, file): Promise<RiderDocument> {
        const signed = await request<{ uploadUrl: string; token: string; path: string }>(
          '/storage/rider-documents/sign-upload',
          { method: 'POST', body: { kind, ext: file.ext }, token: auth() },
        );

        const blob = await (await fetch(file.uri)).blob();
        const put = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': blob.type || 'image/jpeg' },
          body: blob,
        });
        if (!put.ok) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ (HTTP ${put.status})`);

        return request<RiderDocument>('/rider/documents', {
          method: 'POST',
          body: { kind, storagePath: signed.path },
          token: auth(),
        });
      },

      async uploadDeliveryPhoto(orderId, file): Promise<string> {
        const signed = await request<{ uploadUrl: string; path: string }>(
          '/storage/delivery-proof/sign-upload',
          { method: 'POST', body: { orderId, ext: file.ext }, token: auth() },
        );

        const blob = await (await fetch(file.uri)).blob();
        const put = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': blob.type || 'image/jpeg' },
          body: blob,
        });
        if (!put.ok) throw new Error(`อัปโหลดรูปไม่สำเร็จ (HTTP ${put.status})`);

        return signed.path;
      },

      async reportIssue(input): Promise<void> {
        await request(`/rider/jobs/${input.orderId}/issues`, {
          method: 'POST',
          body: { kind: input.kind, ...(input.detail ? { detail: input.detail } : {}) },
          token: auth(),
        });
      },

      async workBase(): Promise<RiderWorkBase | null> {
        return request<RiderWorkBase | null>('/rider/work-base', { token: auth() });
      },

      async setWorkBase(input): Promise<RiderWorkBase | null> {
        return request<RiderWorkBase | null>('/rider/work-base', {
          method: 'POST', body: input, token: auth(),
        });
      },

      async balance(): Promise<RiderBalance> {
        return request<RiderBalance>('/rider/balance', { token: auth() });
      },

      async requestPayout(amountSatang): Promise<RiderPayout> {
        return request<RiderPayout>('/rider/payouts', {
          method: 'POST',
          body: { amountSatang },
          token: auth(),
        });
      },

      async zones(): Promise<Zone[]> {
        return request<Zone[]>('/rider/zones', { token: auth() });
      },

      async application(): Promise<RiderApplication> {
        return request<RiderApplication>('/rider/application', { token: auth() });
      },

      async submitApplication(input): Promise<RiderApplication> {
        return request<RiderApplication>('/rider/application', {
          method: 'POST', body: input, token: auth(),
        });
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

      async decideRiderDocument(accountId, kind, input): Promise<RiderDocument> {
        return request<RiderDocument>(`/admin/riders/${accountId}/documents/${kind}`, {
          method: 'POST',
          body: input,
          token: auth(),
        });
      },

      async resolveRiderIssue(issueId): Promise<void> {
        await request<{ ok: true }>(`/admin/rider-issues/${issueId}/resolve`, {
          method: 'POST',
          token: auth(),
        });
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

      async pendingRiders(): Promise<PendingRider[]> {
        return request<PendingRider[]>('/admin/riders/pending', { token: auth() });
      },

      async decideRider(accountId, input): Promise<RiderApplication> {
        return request<RiderApplication>(`/admin/riders/${accountId}/approval`, {
          method: 'POST', body: input, token: auth(),
        });
      },

      async settleRiderCash(accountId, amountSatang): Promise<CashSettlement> {
        return request<CashSettlement>(`/admin/riders/${accountId}/settle-cash`, {
          method: 'POST', body: { amountSatang }, token: auth(),
        });
      },

      async ridersHoldingCash(): Promise<RiderCashHolder[]> {
        return request<RiderCashHolder[]>('/admin/riders/cash', { token: auth() });
      },

      async riderPayouts(): Promise<PendingRiderPayout[]> {
        return request<PendingRiderPayout[]>('/admin/riders/payouts', { token: auth() });
      },

      async merchantPayouts(): Promise<PendingMerchantPayout[]> {
        return request<PendingMerchantPayout[]>('/admin/restaurants/payout-requests', {
          token: auth(),
        });
      },

      async decideMerchantPayout(payoutId, input): Promise<MerchantPayout> {
        return request<MerchantPayout>(
          `/admin/restaurants/payout-requests/${payoutId}/decide`,
          { method: 'POST', body: input, token: auth() },
        );
      },

      async decideRiderPayout(payoutId, input): Promise<RiderPayout> {
        return request<RiderPayout>(`/admin/riders/payouts/${payoutId}/decide`, {
          method: 'POST', body: input, token: auth(),
        });
      },

      async orders(filter): Promise<AdminOrderRow[]> {
        return request<AdminOrderRow[]>(`/admin/orders?filter=${filter}`, { token: auth() });
      },

      async liveOps(): Promise<LiveOps> {
        return request<LiveOps>('/admin/orders/live', { token: auth() });
      },

      async restaurantPayables(): Promise<RestaurantPayable[]> {
        return request<RestaurantPayable[]>('/admin/restaurants/payables', { token: auth() });
      },

      async settleRestaurant(restaurantId): Promise<{ paidSatang: number }> {
        return request<{ paidSatang: number }>(`/admin/restaurants/${restaurantId}/settle`, {
          method: 'POST', token: auth(),
        });
      },

      async opsMap(): Promise<OpsMapData> {
        return request<OpsMapData>('/admin/ops/map', { token: auth() });
      },

      async riderDocuments(accountId): Promise<RiderDocumentWithUrl[]> {
        return request<RiderDocumentWithUrl[]>(`/admin/riders/${accountId}/documents`, {
          token: auth(),
        });
      },

      async tickets(status): Promise<SupportTicket[]> {
        const query = status ? `?status=${status}` : '';
        return request<SupportTicket[]>(`/admin/support/tickets${query}`, { token: auth() });
      },

      async closeTicket(ticketId): Promise<void> {
        await request<{ ok: true }>(`/admin/support/tickets/${ticketId}/close`, {
          method: 'POST', token: auth(),
        });
      },
    },

    /** design AD4 เธรดอ่านได้เฉพาะเจ้าของกับผู้ดูแลระบบ เซิร์ฟเวอร์เป็นคนบังคับ */
    chat: {
      async thread(orderId, channel): Promise<ChatThread> {
        return request<ChatThread>(`/orders/${orderId}/chat/${channel}`, { token: auth() });
      },

      async send(orderId, channel, body): Promise<void> {
        await request<{ id: string }>(`/orders/${orderId}/chat/${channel}`, {
          method: 'POST', body: { body }, token: auth(),
        });
      },
    },

    reviews: {
      async write(orderId, input): Promise<Review> {
        return request<Review>(`/orders/${orderId}/review`, {
          method: 'POST', body: input, token: auth(),
        });
      },

      async forOrder(orderId): Promise<Review | null> {
        return request<Review | null>(`/orders/${orderId}/review`, { token: auth() });
      },

      /** ไม่แนบ token จอรีวิวของร้านเปิดอ่านได้ตั้งแต่ยังไม่มีบัญชี เหมือนรายชื่อร้าน */
      async forRestaurant(restaurantId): Promise<ReviewSummary> {
        return request<ReviewSummary>(`/catalog/restaurants/${restaurantId}/reviews`);
      },

      async forMyRestaurant(restaurantId): Promise<ReviewSummary> {
        return request<ReviewSummary>(`/merchant/restaurants/${restaurantId}/reviews`, {
          token: auth(),
        });
      },
    },

    support: {
      async open(input): Promise<{ id: string }> {
        return request<{ id: string }>('/support/tickets', {
          method: 'POST', body: input, token: auth(),
        });
      },

      async mine(): Promise<SupportTicket[]> {
        return request<SupportTicket[]>('/support/tickets', { token: auth() });
      },

      async thread(ticketId): Promise<SupportThread> {
        return request<SupportThread>(`/support/tickets/${ticketId}`, { token: auth() });
      },

      async reply(ticketId, body): Promise<void> {
        await request<{ id: string }>(`/support/tickets/${ticketId}/messages`, {
          method: 'POST', body: { body }, token: auth(),
        });
      },
    },

    /** design SA1–SA6 ทุกเส้นทางใต้ `/super/*` ผ่าน `SuperAdminGuard` ฝั่งเซิร์ฟเวอร์ */
    super: {
      async metrics(days = 30): Promise<AdminMetrics> {
        return request<AdminMetrics>(`/super/metrics?days=${days}`, { token: auth() });
      },

      async zones(): Promise<ZoneReport[]> {
        return request<ZoneReport[]>('/super/zones', { token: auth() });
      },

      async createZone(input): Promise<ZoneReport> {
        return request<ZoneReport>('/super/zones', { method: 'POST', body: input, token: auth() });
      },

      async updateZone(id, input): Promise<ZoneReport> {
        return request<ZoneReport>(`/super/zones/${id}`, {
          method: 'PATCH', body: input, token: auth(),
        });
      },

      async admins(): Promise<AdminAccountRow[]> {
        return request<AdminAccountRow[]>('/super/admins', { token: auth() });
      },

      async setRole(accountId, role) {
        return request<{ accountId: string; role: AccountType }>(
          `/super/admins/${accountId}/role`,
          { method: 'POST', body: { role }, token: auth() },
        );
      },

      async grantAdmin(username, role) {
        return request<{ accountId: string; role: AccountType }>(
          '/super/admins',
          { method: 'POST', body: { username, role }, token: auth() },
        );
      },

      async createAdmin(input) {
        return request<{ accountId: string; role: AccountType }>(
          '/super/admins/create',
          { method: 'POST', body: input, token: auth() },
        );
      },

      async config(): Promise<SuperConfig> {
        return request<SuperConfig>('/super/config', { token: auth() });
      },

      async setPricing(input): Promise<PlatformPricing> {
        return request<PlatformPricing>('/super/config/pricing', {
          method: 'PATCH', body: input, token: auth(),
        });
      },

      async setFlag(key, enabled) {
        return request<{ key: FeatureFlagKey; enabled: boolean }>(
          `/super/config/flags/${key}`,
          { method: 'PATCH', body: { enabled }, token: auth() },
        );
      },

      async audit(action): Promise<AuditRow[]> {
        const query = action ? `?action=${encodeURIComponent(action)}` : '';
        return request<AuditRow[]>(`/super/audit${query}`, { token: auth() });
      },
    },
  };
}
