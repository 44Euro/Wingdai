import type {
  Repos, RegisterInput, GoogleRegisterInput, CreateOrderInput, NewAddressInput,
} from '../repositories';
import type { Account, Address, MenuItem, Order, OrderStatus, Restaurant } from '../types';
import { assertTransition } from '../orderStateMachine';
import { canOrderFromRestaurant, canPayNowWithPromptPay } from '../../lib/rules';
import { seedAccounts, seedRestaurants, seedMenuItems, seedAddresses, MOCK_PASSWORD } from './seed';

/**
 * สถานะที่ครัวยังต้องทำต่อ — ต้องตรงกับ QUEUE_STATUSES ใน core-api/src/merchant/merchant.service.ts
 * `picked_up` ไม่อยู่ในนี้ เพราะไรเดอร์รับของไปแล้ว = ครัวไม่ต้องทำอะไรอีก
 */
const QUEUE_STATUSES: OrderStatus[] = ['created', 'accepted', 'preparing'];

/** รหัส OTP ที่ mock ยอมรับ — ของจริงสุ่มหกหลักแล้วส่ง SMS */
export const MOCK_OTP = '123456';
export const MOCK_VERIFICATION_TOKEN = 'mock-verification-token';
const MOCK_GOOGLE_TOKEN = 'mock-google-token';

export function createMockRepos(): Repos {
  // state แยกต่อ instance เพื่อให้เทสต์ไม่รบกวนกัน
  const accounts: Account[] = seedAccounts.map((a) => ({ ...a }));
  const restaurants: Restaurant[] = seedRestaurants.map((r) => ({ ...r }));
  const menuItems: MenuItem[] = seedMenuItems.map((m) => ({ ...m }));
  const addresses: (Address & { accountId: string })[] = seedAddresses.map((a) => ({ ...a }));
  const orders: Order[] = [];
  let seq = 0;

  /**
   * บัญชีที่ล็อกอินอยู่ — ของจริงเซิร์ฟเวอร์รู้จาก token
   * เก็บไว้ตรงนี้เพื่อให้ mock ทำตัวเหมือนของจริง: แอปไม่เคยส่ง customerId ไปให้ปลอมได้
   */
  let current: Account | null = null;

  const delay = () => new Promise<void>((r) => setTimeout(r, 0));

  const requireLogin = (): Account => {
    if (!current) throw new Error('ต้องเข้าสู่ระบบก่อน');
    return current;
  };

  /** สถานะไรเดอร์ในหน่วยความจำ — ของจริงอยู่ที่ตาราง rider_status */
  const riderStates = new Map<
    string,
    { isOnline: boolean; onlineSince: string | null; cashHeld: number; declined: Set<string> }
  >();
  const riderState = (accountId: string) => {
    let s = riderStates.get(accountId);
    if (!s) {
      s = { isOnline: false, onlineSince: null, cashHeld: 0, declined: new Set() };
      riderStates.set(accountId, s);
    }
    return s;
  };

  /** แปลงออร์เดอร์เป็นงานตามที่ไรเดอร์เห็น — พิกัดร้าน/ปลายทางมาจาก seed */
  function toRiderJob(order: Order) {
    const shop = restaurants.find((r) => r.id === order.restaurantId);
    const drop = addresses.find((a) => a.accountId === order.customerId);
    return {
      orderId: order.id,
      reference: order.reference,
      status: order.status as 'accepted' | 'preparing' | 'picked_up',
      restaurantName: shop?.name ?? '',
      restaurantAddress: shop?.name ?? '',
      restaurantLat: 13.7802,
      restaurantLng: 100.5432,
      dropoffAddress: drop?.addressText ?? '',
      dropoffNote: drop?.note ?? null,
      dropoffLat: drop?.lat ?? 13.78,
      dropoffLng: drop?.lng ?? 100.543,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      riderPaySatang: order.deliveryFee,
      // ต้องอ่านจาก paymentStatus ปัจจุบันเสมอ — ลูกค้าเปลี่ยนไปจ่ายพร้อมเพย์กลางทางได้ (§6.5)
      collectCashSatang:
        order.paymentMethod === 'cash' && order.paymentStatus === 'pending'
          ? order.foodTotal + order.deliveryFee + order.serviceFee
          : 0,
    };
  }

  function createAccount(input: {
    username: string; fullName: string; phone: string;
    accountType: Account['accountType']; email?: string;
  }): Account {
    if (accounts.some((a) => a.username === input.username)) {
      throw new Error('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
    }
    const acc: Account = {
      id: `u-${++seq}`,
      accountType: input.accountType,
      username: input.username,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      ownedRestaurantIds: [],
      ...(input.accountType === 'rider' ? { riderApproval: 'pending' as const } : {}),
    };
    accounts.push(acc);
    current = acc;
    return { ...acc };
  }

  return {
    auth: {
      async login(identifier, password) {
        await delay();
        // identifier = username หรือเบอร์โทร (claude.md §4.2) — อีเมลใช้ล็อกอินไม่ได้
        const acc = accounts.find((a) => a.username === identifier || a.phone === identifier);
        if (!acc || password !== MOCK_PASSWORD) {
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        current = acc;
        return { ...acc };
      },

      async requestOtp(phone) {
        await delay();
        if (accounts.some((a) => a.phone === phone)) {
          throw new Error('เบอร์นี้สมัครไว้แล้ว เข้าสู่ระบบได้เลย');
        }
        return { devCode: MOCK_OTP };
      },

      async verifyOtp(_phone, code) {
        await delay();
        if (code !== MOCK_OTP) throw new Error('รหัสไม่ถูกต้อง');
        return MOCK_VERIFICATION_TOKEN;
      },

      async register(input: RegisterInput) {
        await delay();
        if (input.verificationToken !== MOCK_VERIFICATION_TOKEN) {
          throw new Error('ต้องยืนยันเบอร์โทรก่อนสมัคร');
        }
        return createAccount(input);
      },

      async googleSignIn(idToken) {
        await delay();
        // mock ไม่มีบัญชี Google ที่ผูกไว้ล่วงหน้า — เดินเส้นทางคนใหม่เสมอ
        if (!idToken) throw new Error('ยืนยันบัญชี Google ไม่สำเร็จ');
        return {
          needsRegistration: true as const,
          googleToken: MOCK_GOOGLE_TOKEN,
          prefill: { email: 'google.user@example.com', fullName: 'ผู้ใช้ Google' },
        };
      },

      async googleRegister(input: GoogleRegisterInput) {
        await delay();
        if (input.googleToken !== MOCK_GOOGLE_TOKEN) throw new Error('ตั๋วนี้ใช้สมัครไม่ได้');
        if (input.verificationToken !== MOCK_VERIFICATION_TOKEN) {
          throw new Error('ต้องยืนยันเบอร์โทรก่อนสมัคร');
        }
        return createAccount(input);
      },

      async restore() {
        await delay();
        // mock ไม่เก็บเซสชันข้ามการเปิดแอป เพราะ state อยู่ในหน่วยความจำอย่างเดียว
        return current ? { ...current } : null;
      },

      async logout() {
        await delay();
        current = null;
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
      async getMenu(restaurantId) {
        await delay();
        // คืนของที่หมดมาด้วย ให้จอขึ้นป้าย "หมด" — ลูกค้าควรรู้ว่าร้านมีเมนูนี้ แค่วันนี้ไม่มี
        return menuItems.filter((m) => m.restaurantId === restaurantId).map((m) => ({ ...m }));
      },
      async createMenuItem(input) {
        await delay();
        const menuItem: MenuItem = { id: `mi-${++seq}`, ...input };
        menuItems.push(menuItem);
        return { ...menuItem };
      },
      async searchRestaurants(query) {
        await delay();
        const q = query.trim().toLowerCase();
        if (q === '') return [];
        const hitByDish = new Set(
          menuItems.filter((m) => m.name.toLowerCase().includes(q)).map((m) => m.restaurantId),
        );
        return restaurants
          .filter((r) => r.name.toLowerCase().includes(q) || hitByDish.has(r.id))
          .map((r) => ({ ...r }));
      },
    },

    orders: {
      async create(input: CreateOrderInput) {
        await delay();
        const me = requireLogin();

        // guard กันโกงบังคับที่ชั้น repo (เทียบ server-side) — เจ้าของ/ร้านปิด/ไม่อนุมัติ สั่งไม่ได้
        const restaurant = restaurants.find((r) => r.id === input.restaurantId);
        if (!restaurant || !canOrderFromRestaurant(me.id, restaurant)) {
          throw new Error('order.error.ownRestaurant');
        }

        if (!addresses.some((a) => a.accountId === me.id)) {
          throw new Error('order.error.noAddress');
        }

        /**
         * ตีราคาจากเมนู **ไม่ใช่จากที่จอส่งมา** — เหมือนที่เซิร์ฟเวอร์ทำ
         * ถ้า mock ยอมรับราคาจากจอ เราจะไม่มีทางรู้ว่าจอเผลอส่งราคาผิดมาหรือไม่
         */
        const items = input.items.map((line) => {
          const menu = menuItems.find((m) => m.id === line.menuItemId);
          if (!menu || menu.restaurantId !== input.restaurantId) {
            throw new Error('order.error.itemNotInMenu');
          }
          if (!menu.isAvailable) throw new Error('order.error.itemUnavailable');

          const chosen = (menu.optionGroups ?? []).flatMap((g) => {
            const picked = g.choices.filter((c) => line.choiceIds.includes(c.id));
            if (picked.length < g.minSelect || picked.length > g.maxSelect) {
              throw new Error('order.error.optionRequired');
            }
            return picked;
          });

          return {
            menuItemId: menu.id,
            name: chosen.length ? `${menu.name} (${chosen.map((c) => c.name).join(', ')})` : menu.name,
            unitPrice: menu.price + chosen.reduce((s, c) => s + c.priceDelta, 0),
            quantity: line.quantity,
          };
        });

        const foodTotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const order: Order = {
          id: `o-${++seq}`,
          reference: `WD-MOCK${seq}`,
          customerId: me.id,
          restaurantId: input.restaurantId,
          status: 'created',
          items,
          foodTotal,
          deliveryFee: 1500,
          serviceFee: 500,
          paymentMethod: input.paymentMethod,
          // เงินสดยังไม่ได้จ่าย ไรเดอร์เก็บตอนส่ง — ช่องทางอื่นจ่ายจบก่อนออร์เดอร์เริ่มเดิน
          paymentStatus: input.paymentMethod === 'cash' ? 'pending' : 'paid',
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
      async payWithPromptPay(orderId) {
        await delay();
        const o = orders.find((x) => x.id === orderId);
        if (!o) throw new Error(`ไม่พบออร์เดอร์ ${orderId}`);
        // ตรวจซ้ำที่ชั้น repo ไม่ใช่เชื่อว่าจอซ่อนปุ่มไว้แล้ว — ของจริงต้องเป็นเซิร์ฟเวอร์ที่ตัดสิน
        if (!canPayNowWithPromptPay(o)) throw new Error('payment.error.cannotSwitch');
        o.paymentMethod = 'promptpay';
        o.paymentStatus = 'paid';
        return { ...o };
      },
    },

    merchant: {
      async myRestaurants() {
        await delay();
        const me = requireLogin();
        return restaurants
          .filter((r) => r.ownerUserId === me.id)
          .map((r) => ({
            id: r.id,
            name: r.name,
            isApproved: r.isApproved,
            isOpen: r.isOpen,
            prepTimeMinutes: r.prepTimeMinutes,
          }));
      },

      async listOrders(opts) {
        await delay();
        const me = requireLogin();
        const mine = restaurants.filter(
          (r) => r.ownerUserId === me.id && (!opts?.restaurantId || r.id === opts.restaurantId),
        );
        const ids = new Set(mine.map((r) => r.id));
        const queue = (opts?.scope ?? 'queue') === 'queue';

        return orders
          .filter((o) => ids.has(o.restaurantId) && QUEUE_STATUSES.includes(o.status) === queue)
          .sort((a, b) =>
            queue ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
          )
          .map((o) => {
            // §6.1 ปัดลงเหมือนฝั่งเซิร์ฟเวอร์ ส่วนที่ปัดทิ้งตกเป็นของร้าน ไม่ใช่ของแพลตฟอร์ม
            const commission = Math.floor((o.foodTotal * 1500) / 10000);
            const shop = restaurants.find((r) => r.id === o.restaurantId)!;
            const customer = accounts.find((a) => a.id === o.customerId);
            return {
              id: o.id,
              reference: o.reference,
              restaurantId: o.restaurantId,
              restaurantName: shop.name,
              status: o.status,
              customerName: customer?.fullName ?? '',
              items: o.items.map((i) => ({
                name: i.name,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
              })),
              foodTotal: o.foodTotal,
              commission,
              restaurantPayout: o.foodTotal - commission,
              paymentMethod: o.paymentMethod,
              paymentStatus: o.paymentStatus,
              hasRider: !!o.riderId,
              createdAt: o.createdAt,
              acceptedAt: o.status === 'created' ? null : o.createdAt,
            };
          });
      },

      async setOpen(restaurantId, isOpen) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.ownerUserId === me.id);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        if (!shop.isApproved && isOpen) throw new Error('ร้านนี้ยังรออนุมัติ เปิดรับออร์เดอร์ไม่ได้');
        shop.isOpen = isOpen;
        return {
          id: shop.id,
          name: shop.name,
          isApproved: shop.isApproved,
          isOpen: shop.isOpen,
          prepTimeMinutes: shop.prepTimeMinutes,
        };
      },

      async updateMenuItem(menuItemId, patch) {
        await delay();
        const me = requireLogin();
        const item = menuItems.find((m) => m.id === menuItemId);
        const shop = item && restaurants.find((r) => r.id === item.restaurantId);
        if (!item || shop?.ownerUserId !== me.id) throw new Error('ไม่พบเมนูนี้');
        Object.assign(item, patch);
        return { ...item };
      },
    },

    rider: {
      async status() {
        await delay();
        const me = requireLogin();
        const state = riderState(me.id);

        /*
         * mock ไม่มีเครื่องจ่ายงานจริง — จำลองว่า "ออนไลน์อยู่และมีออร์เดอร์ที่ร้านรับแล้ว
         * แต่ยังไม่มีไรเดอร์" = ถูกเสนองานใบนั้น ซึ่งพอให้จอนับถอยหลังทำงานได้เหมือนของจริง
         * กติกาจริงทั้งหมด (คะแนน จังหวะเวลา คุณสมบัติ) อยู่ฝั่งเซิร์ฟเวอร์
         */
        const candidate = state.isOnline
          ? orders.find(
              (o) =>
                !o.riderId &&
                (o.status === 'accepted' || o.status === 'preparing') &&
                // §4.3 ไม่เสนอออร์เดอร์ที่ไรเดอร์คนนี้สั่งเอง
                o.customerId !== me.id &&
                // ผ่านไปแล้วให้ "ข้ามไปใบถัดไป" ไม่ใช่หยุดเสนอทั้งหมด (ตรงกับ tick() ฝั่งเซิร์ฟเวอร์)
                !state.declined.has(o.id),
            )
          : undefined;

        const offer = candidate
          ? {
              ...toRiderJob(candidate),
              offerId: `offer-${candidate.id}`,
              expiresAt: new Date(Date.now() + 15_000).toISOString(),
            }
          : null;

        return {
          approval: me.riderApproval ?? 'approved',
          isOnline: state.isOnline,
          onlineSince: state.onlineSince,
          cashHeldSatang: state.cashHeld,
          cashLimitSatang: 150_000,
          activeJobs: orders.filter((o) => o.riderId === me.id && o.status !== 'delivered' && o.status !== 'cancelled')
            .map(toRiderJob),
          offer,
        };
      },

      async setOnline(isOnline, at) {
        await delay();
        const me = requireLogin();
        if ((me.riderApproval ?? 'approved') !== 'approved') throw new Error('บัญชีไรเดอร์ยังรออนุมัติ');
        // ตรงกับเซิร์ฟเวอร์: ไม่รู้พิกัดก็ให้คะแนนระยะทางไม่ได้ จึงออนไลน์ไม่ได้
        if (isOnline && !at) throw new Error('ต้องเปิดตำแหน่งก่อนเริ่มรับงาน');
        const state = riderState(me.id);
        state.isOnline = isOnline;
        state.onlineSince = isOnline ? (state.onlineSince ?? new Date().toISOString()) : null;
        return this.status();
      },

      async ping() {
        await delay();
        requireLogin();
      },

      async jobs() {
        await delay();
        const me = requireLogin();
        return orders
          .filter((o) => o.riderId === me.id && o.status !== 'delivered' && o.status !== 'cancelled')
          .map(toRiderJob);
      },

      async acceptOffer(orderId) {
        await delay();
        const me = requireLogin();
        const order = orders.find((o) => o.id === orderId);
        if (!order) throw new Error('ไม่พบงานนี้');
        if (order.riderId) throw new Error('งานนี้มีคนรับไปแล้ว');
        // claude.md §4.3 — ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้
        if (order.customerId === me.id) throw new Error('รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้');
        order.riderId = me.id;
        return toRiderJob(order);
      },

      async declineOffer(orderId) {
        await delay();
        const me = requireLogin();
        riderState(me.id).declined.add(orderId);
      },

      async stats() {
        await delay();
        const me = requireLogin();
        const delivered = orders.filter((o) => o.riderId === me.id && o.status === 'delivered').length;
        const state = riderState(me.id);
        const hours = state.onlineSince
          ? (Date.now() - new Date(state.onlineSince).getTime()) / 3_600_000
          : 0;
        // ยังไม่เคยออนไลน์ = ยังไม่มีค่านี้ ไม่ใช่ 0 (0 อ่านเหมือน "ทำได้แย่")
        return {
          hours: Number(hours.toFixed(2)),
          delivered,
          ordersPerHour: hours > 0 ? Number((delivered / hours).toFixed(2)) : null,
        };
      },
    },

    addresses: {
      async list() {
        await delay();
        const me = requireLogin();
        return addresses.filter((a) => a.accountId === me.id).map(({ accountId, ...a }) => a);
      },
      async add(input: NewAddressInput) {
        await delay();
        const me = requireLogin();
        const address = { id: `addr-${++seq}`, accountId: me.id, ...input };
        addresses.push(address);
        const { accountId, ...pub } = address;
        return pub;
      },
    },
  };
}
