import type {
  Repos, RegisterInput, GoogleRegisterInput, CreateOrderInput, NewAddressInput,
} from '../repositories';
import type {
  Account, Address, MenuItem, Order, OrderStatus, Restaurant, RefundCase, RefundFault,
  RiderApplication, Zone,
} from '../types';
import { assertTransition } from '../orderStateMachine';
import { canOrderFromRestaurant, canPayNowWithPromptPay } from '../../lib/rules';
import { validateDraft } from '../../lib/riderApplication';
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

/** เพดานเงินสดในมือ — ตรงกับ rider_profiles.cash_limit_satang ฝั่งเซิร์ฟเวอร์ (฿1,500) */
const CASH_LIMIT_SATANG = 150000;

/** โซนที่เปิดให้บริการใน mock — ของจริงมาจากตาราง zones ที่มีขอบเขต PostGIS */
const MOCK_ZONES: Zone[] = [{ id: 'z-ari', name: 'อารีย์', type: 'mixed' }];

/**
 * ชื่อบัญชีตรงกับชื่อตามกฎหมายไหม — ธงกันบัญชีม้า (§7)
 * ตัวจริงอยู่ที่ core-api/src/dispatch/riderApplication.ts
 */
function bankNameMatchesLegalName(bankAccountName: string, fullName: string): boolean {
  const strip = (v: string) =>
    v.replace(/(นาย|นาง|นางสาว|น\.ส\.|mr\.?|mrs\.?|ms\.?)/gi, '').replace(/\s+/g, '').toLowerCase();
  return strip(bankAccountName) === strip(fullName);
}

export function createMockRepos(): Repos {
  // state แยกต่อ instance เพื่อให้เทสต์ไม่รบกวนกัน
  const accounts: Account[] = seedAccounts.map((a) => ({ ...a }));
  const restaurants: Restaurant[] = seedRestaurants.map((r) => ({ ...r }));
  const menuItems: MenuItem[] = seedMenuItems.map((m) => ({ ...m }));
  const addresses: (Address & { accountId: string })[] = seedAddresses.map((a) => ({ ...a }));
  const orders: Order[] = [];
  const refundCases: RefundCase[] = [];
  /**
   * เวลาที่ส่งถึงของแต่ละใบ — ชนิด `Order` ฝั่งแอปไม่มีช่องนี้ (เซิร์ฟเวอร์มี `delivered_at`)
   * ถ้าไม่จำไว้ จอประวัติงานจะต้องเอาเวลา "ตอนสั่ง" มาโชว์เป็น "เวลาส่งถึง" ซึ่งผิด
   */
  const deliveredAtById = new Map<string, string>();
  /** ใบสมัครไรเดอร์ในหน่วยความจำ — ของจริงคือตาราง rider_profiles */
  const riderApplications = new Map<string, RiderApplication>();
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

      async updateProfile(input) {
        await delay();
        const me = requireLogin();
        const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;

        // อีเมลเป็นช่องทางรีเซ็ตรหัสผ่าน — สองบัญชีใช้ซ้ำกันไม่ได้ เหมือนที่เซิร์ฟเวอร์เช็ค
        if (email && accounts.some((a) => a.id !== me.id && a.email === email)) {
          throw new Error('อีเมลนี้มีคนใช้แล้ว');
        }

        const row = accounts.find((a) => a.id === me.id)!;
        row.fullName = input.fullName.trim();
        row.email = email ?? undefined;
        current = { ...row };
        return { ...row };
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
        if (status === 'delivered') {
          deliveredAtById.set(o.id, new Date().toISOString());
          /*
           * §6.2 — ลูกค้าจ่ายเงินสดตอนรับของ เงินก้อนนั้นเป็นของแพลตฟอร์มแต่ไปอยู่ในมือไรเดอร์
           * ต้องทำใน mock ด้วย ไม่งั้นจอเงินสดในมือกับเพดานจะเป็นศูนย์ตลอด และเทสต์จะไม่เจอ
           * ปัญหาที่ของจริงเจอ (ชนเพดานแล้วรับงานเงินสดไม่ได้)
           */
          if (o.paymentMethod === 'cash' && o.paymentStatus === 'pending') {
            o.paymentStatus = 'paid';
            if (o.riderId) {
              riderState(o.riderId).cashHeld += o.foodTotal + o.deliveryFee + o.serviceFee;
            }
          }
        }
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
      async registerRestaurant(input) {
        await delay();
        const me = requireLogin();
        // §4.1 ร้านเป็นการอัปเกรดบนบัญชี user — ไรเดอร์เปิดร้านไม่ได้
        if (me.accountType !== 'user') throw new Error('เปิดร้านได้เฉพาะบัญชีลูกค้าเท่านั้น');

        /*
         * ของจริงเช็คด้วย PostGIS ว่าพิกัดอยู่ใน polygon ของโซนที่เปิดให้บริการ
         * mock เช็คหยาบ ๆ ด้วยกล่องรอบย่านอารีย์ พอให้จอเจอเคส "นอกโซน" ได้
         */
        const inZone =
          input.lat > 13.77 && input.lat < 13.79 && input.lng > 100.53 && input.lng < 100.56;
        if (!inZone) throw new Error('ที่ตั้งร้านอยู่นอกโซนที่เปิดให้บริการ');

        const shop: Restaurant = {
          id: `r-${++seq}`,
          ownerUserId: me.id,
          name: input.name,
          isApproved: false,
          isOpen: false,
          cuisine: input.cuisine,
          distanceKm: null,
          prepTimeMinutes: input.prepTimeMinutes,
          rating: null,
        };
        restaurants.push(shop);
        return {
          id: shop.id, name: shop.name, isApproved: false, isOpen: false,
          prepTimeMinutes: shop.prepTimeMinutes, zoneName: 'อารีย์',
        };
      },

      async submitForApproval(restaurantId) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.ownerUserId === me.id);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        // §7 ร้านที่อนุมัติแล้วแต่ไม่มีเมนู = ลูกค้ากดเข้าไปเจอหน้าว่าง
        const count = menuItems.filter((m) => m.restaurantId === restaurantId).length;
        if (count < 3) throw new Error(`ต้องมีเมนูอย่างน้อย 3 รายการก่อนส่งให้ตรวจ (ตอนนี้มี ${count})`);
        return { submitted: true };
      },

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

      async summary(restaurantId) {
        await delay();
        const me = requireLogin();
        const mine = restaurants.filter(
          (r) => r.ownerUserId === me.id && (!restaurantId || r.id === restaurantId),
        );
        const ids = new Set(mine.map((r) => r.id));

        const done = orders.filter((o) => ids.has(o.restaurantId) && o.status === 'delivered');
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const today = done.filter(
          (o) => new Date(deliveredAtById.get(o.id) ?? o.createdAt) >= startOfToday,
        );

        // คอมมิชชัน 15% ของค่าอาหารเท่านั้น ไม่รวมค่าส่ง/ค่าบริการ (claude.md §6.1)
        const salesOf = (rows: Order[]) => {
          const foodSalesSatang = rows.reduce((s, o) => s + o.foodTotal, 0);
          const commissionSatang = rows.reduce((s, o) => s + Math.round(o.foodTotal * 0.15), 0);
          return {
            orders: rows.length,
            foodSalesSatang,
            commissionSatang,
            netSatang: foodSalesSatang - commissionSatang,
          };
        };

        return {
          today: salesOf(today),
          last7Days: salesOf(done),
          openQueue: orders.filter(
            (o) => ids.has(o.restaurantId) && ['created', 'accepted', 'preparing'].includes(o.status),
          ).length,
          restaurantCount: mine.length,
        };
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

      async zones() {
        await delay();
        return MOCK_ZONES.map((z) => ({ ...z }));
      },

      async application() {
        await delay();
        const me = requireLogin();
        return (
          riderApplications.get(me.id)
          ?? { status: 'none' as const, rejectionReason: null, profile: null }
        );
      },

      async submitApplication(input) {
        await delay();
        const me = requireLogin();
        // §4.1 ไรเดอร์เลือกตอนสมัครบัญชี ไม่ใช่ความสามารถที่บัญชี user เพิ่มทีหลัง
        if (me.accountType !== 'rider') throw new Error('เฉพาะบัญชีไรเดอร์เท่านั้นที่ส่งใบสมัครนี้ได้');

        const current = riderApplications.get(me.id)?.status;
        if (current === 'approved') throw new Error('ใบสมัครได้รับการอนุมัติแล้ว แก้ไขข้อมูลเองไม่ได้');
        if (current === 'pending') throw new Error('ส่งใบสมัครไปแล้ว กำลังรอตรวจสอบ');

        // ตรวจซ้ำที่ชั้น repo เหมือนที่เซิร์ฟเวอร์ทำ ไม่ใช่เชื่อว่าจอกันไว้แล้ว
        const errors = validateDraft({ ...input }, new Date());
        if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0]!);

        const app: RiderApplication = {
          status: 'pending',
          rejectionReason: null,
          profile: {
            nationalId: input.nationalId.replace(/\D/g, ''),
            dateOfBirth: input.dateOfBirth,
            vehicleRegistration: input.vehicleRegistration.trim(),
            licenceExpiry: input.licenceExpiry,
            compulsoryInsuranceExpiry: input.compulsoryInsuranceExpiry,
            bankName: input.bankName.trim(),
            bankAccountNumber: input.bankAccountNumber.replace(/\D/g, ''),
            bankAccountName: input.bankAccountName.trim(),
            emergencyContactName: input.emergencyContactName.trim(),
            emergencyContactPhone: input.emergencyContactPhone.replace(/\D/g, ''),
            preferredZoneId: input.preferredZoneId ?? null,
          },
        };
        riderApplications.set(me.id, app);
        return app;
      },

      async earnings() {
        await delay();
        const me = requireLogin();
        const stats = await this.stats();

        const mine = orders
          .filter((o) => o.riderId === me.id && o.status === 'delivered')
          .map((o) => ({
            orderId: o.id,
            reference: o.reference,
            restaurantName:
              restaurants.find((r) => r.id === o.restaurantId)?.name ?? o.restaurantId,
            dropoffAddress: addresses.find((a) => a.accountId === o.customerId)?.addressText ?? '',
            deliveredAt: deliveredAtById.get(o.id) ?? o.createdAt,
            // รายได้ของไรเดอร์คือค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่าย
            riderPaySatang: o.deliveryFee,
            paymentMethod: o.paymentMethod,
          }))
          .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));

        return {
          ...stats,
          sinceDays: 7,
          totalPaySatang: mine.reduce((s, d) => s + d.riderPaySatang, 0),
          deliveries: mine,
        };
      },
    },

    refunds: {
      async open(input) {
        await delay();
        const me = requireLogin();
        const order = orders.find((o) => o.id === input.orderId && o.customerId === me.id);
        if (!order) throw new Error('ไม่พบออร์เดอร์นี้');
        if (refundCases.some((c) => c.orderId === order.id && (c.status === 'open' || c.status === 'auto_verified'))) {
          throw new Error('ออร์เดอร์นี้มีเรื่องที่กำลังตรวจอยู่แล้ว');
        }

        /*
         * ตรรกะการตรวจอัตโนมัติจริงอยู่ฝั่งเซิร์ฟเวอร์ (refunds/autoVerify.ts)
         * ที่นี่จำลองผลลัพธ์ให้พอทำให้จอทำงานได้ ไม่ได้เขียนกติกาซ้ำสองที่
         */
        const total = order.foodTotal + order.deliveryFee + order.serviceFee;
        const fault: RefundFault | null =
          input.reason === 'damaged' || input.reason === 'not_delivered' ? 'rider'
            : input.reason === 'late' ? 'platform'
              : input.reason === 'other' ? null
                : 'restaurant';
        const full = fault !== null && total <= 20_000;

        const c: RefundCase = {
          id: `rc-${++seq}`,
          orderId: order.id,
          reference: order.reference,
          status: 'auto_verified',
          customerReason: `${input.reason}: ${input.detail}`,
          autoVerdict: full ? 'suggest_full' : 'needs_review',
          reasoning: full
            ? ['ตรวจอัตโนมัติผ่านทุกข้อ — เสนอคืนเต็มจำนวน']
            : ['ต้องให้คนตรวจก่อน'],
          suggestedAmountSatang: full ? total : null,
          approvedAmountSatang: null,
          fault,
          createdAt: new Date().toISOString(),
          decidedAt: null,
        };
        refundCases.push(c);
        return { ...c };
      },

      async mine() {
        await delay();
        const me = requireLogin();
        const mineIds = new Set(orders.filter((o) => o.customerId === me.id).map((o) => o.id));
        return refundCases.filter((c) => mineIds.has(c.orderId)).map((c) => ({ ...c }));
      },
    },

    admin: {
      async exceptions() {
        await delay();
        requireLogin();
        const open = refundCases.filter((c) => c.status === 'auto_verified' || c.status === 'open');
        return open.map((c) => {
          const order = orders.find((o) => o.id === c.orderId)!;
          const shop = restaurants.find((r) => r.id === order.restaurantId);
          const minutes = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60_000);
          return {
            kind: 'open_dispute' as const,
            orderId: order.id,
            reference: order.reference,
            restaurantName: shop?.name ?? '',
            status: order.status,
            minutesWaiting: minutes,
            detail: `ลูกค้าแจ้งปัญหามา ${minutes} นาทีแล้วยังไม่ได้ตัดสิน`,
          };
        });
      },

      async metrics() {
        await delay();
        requireLogin();
        const delivered = orders.filter((o) => o.status === 'delivered').length;
        const refunded = refundCases.filter((c) => c.status === 'approved').length;
        // ยังไม่มีข้อมูล = null ไม่ใช่ 0 — 0 อ่านเหมือนตัวเลขจริงที่แย่หรือดี
        return {
          windowDays: 7,
          orders: orders.length,
          delivered,
          ordersPerRiderHour: null,
          restaurantAcceptRate: orders.length > 0
            ? orders.filter((o) => o.status !== 'created').length / orders.length
            : null,
          refundRate: delivered > 0 ? refunded / delivered : null,
          autoDispatchRate: null,
        };
      },

      async openRefunds() {
        await delay();
        requireLogin();
        return refundCases
          .filter((c) => c.status === 'auto_verified' || c.status === 'open')
          .map((c) => ({ ...c }));
      },

      async decideRefund(caseId, input) {
        await delay();
        requireLogin();
        const c = refundCases.find((x) => x.id === caseId);
        if (!c) throw new Error('ไม่พบเรื่องนี้');
        if (c.status === 'approved' || c.status === 'rejected') throw new Error('เรื่องนี้ตัดสินไปแล้ว');

        if (!input.approve) {
          c.status = 'rejected';
        } else {
          const fault = input.fault ?? c.fault;
          // ไม่รู้ว่าใครรับผิดชอบ = ไม่รู้ว่าจะหักจากบัญชีไหน (§6.4)
          if (!fault) throw new Error('ต้องระบุว่าใครรับผิดชอบก่อนอนุมัติคืนเงิน');
          c.status = 'approved';
          c.fault = fault;
          c.approvedAmountSatang = input.amountSatang ?? c.suggestedAmountSatang ?? 0;
          const order = orders.find((o) => o.id === c.orderId);
          if (order) order.paymentStatus = 'refunded';
        }
        c.decidedAt = new Date().toISOString();
        return { ...c };
      },

      async forceDispatch() {
        await delay();
        requireLogin();
        // mock ไม่มีเครื่องจ่ายงาน — ของจริงอยู่ที่ dispatch/dispatch.service.ts
        return { offered: false, reason: 'โหมดจำลองไม่มีเครื่องจ่ายงาน' };
      },

      async pendingRestaurants() {
        await delay();
        requireLogin();
        return restaurants
          .filter((r) => !r.isApproved)
          .map((r) => {
            const owner = accounts.find((a) => a.id === r.ownerUserId);
            return {
              id: r.id,
              name: r.name,
              isApproved: r.isApproved,
              isOpen: r.isOpen,
              prepTimeMinutes: r.prepTimeMinutes,
              ownerName: owner?.fullName ?? '',
              ownerPhone: owner?.phone ?? '',
              addressText: r.name,
              menuItemCount: menuItems.filter((m) => m.restaurantId === r.id).length,
              createdAt: new Date().toISOString(),
            };
          });
      },

      async decideRestaurant(restaurantId, approve) {
        await delay();
        requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        shop.isApproved = approve;
        return {
          id: shop.id, name: shop.name, isApproved: shop.isApproved,
          isOpen: shop.isOpen, prepTimeMinutes: shop.prepTimeMinutes,
        };
      },

      async pendingRiders() {
        await delay();
        requireLogin();
        const out = [];
        for (const [accountId, app] of riderApplications) {
          if (app.status !== 'pending' || !app.profile) continue;
          const person = accounts.find((a) => a.id === accountId);
          if (!person) continue;
          out.push({
            ...app.profile,
            accountId,
            fullName: person.fullName,
            phone: person.phone,
            zoneName: MOCK_ZONES.find((z) => z.id === app.profile!.preferredZoneId)?.name ?? null,
            // §7 ชื่อบัญชีไม่ตรงชื่อจริง = ธงบัญชีม้า ให้แอดมินดู ไม่ใช่ตัดสินอัตโนมัติ
            bankNameMatches: bankNameMatchesLegalName(app.profile.bankAccountName, person.fullName),
          });
        }
        return out;
      },

      async ridersHoldingCash() {
        await delay();
        requireLogin();
        const out = [];
        for (const [accountId, st] of riderStates) {
          if (st.cashHeld <= 0) continue;
          const person = accounts.find((a) => a.id === accountId);
          if (!person) continue;
          out.push({
            accountId,
            fullName: person.fullName,
            phone: person.phone,
            cashHeldSatang: st.cashHeld,
            cashLimitSatang: CASH_LIMIT_SATANG,
            atLimit: st.cashHeld >= CASH_LIMIT_SATANG,
          });
        }
        return out.sort((a, b) => b.cashHeldSatang - a.cashHeldSatang);
      },

      async settleRiderCash(accountId, amountSatang) {
        await delay();
        requireLogin();
        if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
          throw new Error('ยอดนำส่งต้องเป็นจำนวนเต็มสตางค์ที่มากกว่าศูนย์');
        }
        const st = riderState(accountId);
        // รับเกินยอดที่ถืออยู่ไม่ได้ — เกินแปลว่านับเงินผิด หรือมีใบที่ไม่ได้ถูกบันทึก
        if (amountSatang > st.cashHeld) {
          throw new Error('ยอดนำส่งเกินเงินสดที่ไรเดอร์ถืออยู่');
        }
        st.cashHeld -= amountSatang;
        return { riderAccountId: accountId, settledSatang: amountSatang, cashHeldSatang: st.cashHeld };
      },

      async decideRider(accountId, input) {
        await delay();
        requireLogin();
        const app = riderApplications.get(accountId);
        if (!app) throw new Error('ไม่พบใบสมัครนี้');
        if (!input.approve && !input.rejectionReason?.trim()) {
          throw new Error('ต้องบอกเหตุผลที่ปฏิเสธ');
        }
        const next: RiderApplication = {
          ...app,
          status: input.approve ? 'approved' : 'rejected',
          rejectionReason: input.approve ? null : input.rejectionReason!.trim(),
        };
        riderApplications.set(accountId, next);
        const person = accounts.find((a) => a.id === accountId);
        if (person) person.riderApproval = next.status as never;
        return next;
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
