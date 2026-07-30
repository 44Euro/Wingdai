import type {
  Repos, RegisterInput, GoogleRegisterInput, CreateOrderInput, NewAddressInput,
} from '../repositories';
import type { Account, Address, MenuItem, Order, Restaurant } from '../types';
import { assertTransition } from '../orderStateMachine';
import { canOrderFromRestaurant, canPayNowWithPromptPay } from '../../lib/rules';
import { seedAccounts, seedRestaurants, seedMenuItems, seedAddresses, MOCK_PASSWORD } from './seed';

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
