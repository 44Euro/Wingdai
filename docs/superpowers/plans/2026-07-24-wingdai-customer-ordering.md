# Wingdai Customer Ordering (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ลูกค้า browse ร้านใกล้เคียง → เข้าร้าน → เลือกเมนู → ตะกร้า → จ่ายเงิน (PromptPay mock) → ได้ Order จริงในระบบ mock (spec §11 ขั้น 4).

**Architecture:** ต่อ data layer 3 ชั้นเดิม (Repos → mock → TanStack Query hooks) + Zustand cart. แทน `CustomerStack` ที่เป็น `PlaceholderStack` ด้วย native-stack จริง 5 จอ. Guard กันโกงบังคับที่ชั้น repo (`canOrderFromRestaurant` มีอยู่แล้วใน `rules.ts`).

**Tech Stack:** React Native + Expo SDK 57, TypeScript, @react-navigation/native-stack, @tanstack/react-query, zustand, i18next, react-test-renderer (ไม่มี @testing-library).

## Global Constraints

- เงินทุกค่าเป็น **สตางค์ (integer)** ภายใน; แสดงผลผ่าน `formatBaht(satang)` (claude.md §7)
- แยก `foodTotal` / `deliveryFee` / `serviceFee` เสมอ ห้ามรวบเป็นก้อนเดียว; ราคาเมนู = ราคาหน้าร้าน ห้ามบวก markup (claude.md §3 หลักการ 2)
- ค่าธรรมเนียม mock คงที่: `DELIVERY_FEE = 1500`, `SERVICE_FEE = 500` (สตางค์)
- guard กันโกงบังคับที่ชั้น repo: เจ้าของ/ร้านปิด/ร้านไม่อนุมัติ สั่งไม่ได้ (claude.md §4.3) — ใช้ `canOrderFromRestaurant(accountId, restaurant)` เดิม
- ทุกสตริง user-facing ผ่าน i18n key (namespace `customer.*`, `order.*`); เพิ่มทั้ง `th.json` **และ** `en.json` พร้อมกันเสมอ (เทสต์ `translate.test.ts` เช็ค parity)
- `TextInput` ทุกตัว `allowFontScaling={false}`; ใช้ `Text`/`Button`/tokens กลาง; dark mode ผ่าน semantic tokens; **ห้าม glass** ทุกจอใน slice นี้ (พื้นทึบ)
- ตะกร้าผูก **ร้านเดียว**; add-ons เมนู **ไม่ทำ** ใน slice นี้
- ก่อน commit ทุก task: `npx jest` (ทั้งหมด ไม่ skip) + `npx tsc --noEmit` เขียว
- commit conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- รันคำสั่งจาก `apps/mobile/`

---

## Task 1: Data model + seed (MenuItem, Restaurant fields, menu seed)

**Files:**
- Modify: `apps/mobile/src/data/types/index.ts`
- Modify: `apps/mobile/src/data/mock/seed.ts`
- Test: `apps/mobile/__tests__/data/seed.test.ts` (create)

**Interfaces (produces):**
- `CuisineCategory = 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert'`
- `Restaurant` เพิ่ม `cuisine: CuisineCategory`, `distanceKm: number`, `prepTimeMinutes: number`
- `MenuItem { id; restaurantId; name; description?; price /*satang*/; category: CuisineCategory; isAvailable: boolean }`
- `seedMenuItems: MenuItem[]`

- [ ] **Step 1: Write the failing test** — `apps/mobile/__tests__/data/seed.test.ts`

```ts
import { seedRestaurants, seedMenuItems } from '../../src/data/mock/seed';

describe('seed data', () => {
  it('ร้าน approved ทุกร้านมี cuisine/distanceKm/prepTimeMinutes', () => {
    const approved = seedRestaurants.filter((r) => r.isApproved);
    expect(approved.length).toBeGreaterThanOrEqual(2);
    approved.forEach((r) => {
      expect(typeof r.cuisine).toBe('string');
      expect(r.distanceKm).toBeGreaterThan(0);
      expect(r.prepTimeMinutes).toBeGreaterThan(0);
    });
  });

  it('ร้าน approved ทุกร้านมีเมนูอย่างน้อย 1 รายการ ราคาเป็นสตางค์ integer บวก', () => {
    seedRestaurants.filter((r) => r.isApproved).forEach((r) => {
      const menu = seedMenuItems.filter((m) => m.restaurantId === r.id);
      expect(menu.length).toBeGreaterThanOrEqual(1);
      menu.forEach((m) => {
        expect(Number.isInteger(m.price)).toBe(true);
        expect(m.price).toBeGreaterThan(0);
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx jest seed.test` → FAIL (`seedMenuItems` ไม่มี / type error)

- [ ] **Step 3: Extend types** — `apps/mobile/src/data/types/index.ts` เพิ่มก่อน `Order`:

```ts
export type CuisineCategory = 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert';

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  /** สตางค์ (claude.md §7) */
  price: number;
  category: CuisineCategory;
  isAvailable: boolean;
}
```

และแก้ `Restaurant` เพิ่ม 3 field:

```ts
export interface Restaurant {
  id: string;
  ownerUserId: string;
  name: string;
  isApproved: boolean;
  isOpen: boolean;
  cuisine: CuisineCategory;
  /** mock ระยะทางจากผู้ใช้ (กม.) — density ตาม claude.md §1 */
  distanceKm: number;
  /** ค่าคงที่ที่ร้านตั้งเอง — seed cold-start ให้ dispatch (§6.3) */
  prepTimeMinutes: number;
}
```

- [ ] **Step 4: Extend seed** — `apps/mobile/src/data/mock/seed.ts`: เพิ่ม field ใหม่ให้ทุกร้าน แล้วเพิ่ม `seedMenuItems`. แทน `seedRestaurants` ทั้งบล็อกด้วย:

```ts
export const seedRestaurants: Restaurant[] = [
  { id: 'r-malee', ownerUserId: 'u-malee', name: 'ครัวมาลี', isApproved: true, isOpen: true, cuisine: 'rice', distanceKm: 0.6, prepTimeMinutes: 12 },
  { id: 'r-somtam', ownerUserId: 'u-other', name: 'ส้มตำแซ่บนัว', isApproved: true, isOpen: true, cuisine: 'somtam', distanceKm: 1.1, prepTimeMinutes: 10 },
  { id: 'r-closed', ownerUserId: 'u-other', name: 'ก๋วยเตี๋ยวเรือ', isApproved: true, isOpen: false, cuisine: 'noodle', distanceKm: 0.9, prepTimeMinutes: 8 },
  { id: 'r-pending', ownerUserId: 'u-somchai', name: 'ร้านรออนุมัติ', isApproved: false, isOpen: false, cuisine: 'rice', distanceKm: 1.4, prepTimeMinutes: 15 },
];

export const seedMenuItems: MenuItem[] = [
  // ครัวมาลี (rice)
  { id: 'm-malee-1', restaurantId: 'r-malee', name: 'ข้าวกะเพราหมูสับ', description: 'ไข่ดาวกรอบ', price: 5000, category: 'rice', isAvailable: true },
  { id: 'm-malee-2', restaurantId: 'r-malee', name: 'ข้าวผัดกุ้ง', price: 6000, category: 'rice', isAvailable: true },
  { id: 'm-malee-3', restaurantId: 'r-malee', name: 'ข้าวมันไก่', price: 4500, category: 'rice', isAvailable: true },
  { id: 'm-malee-4', restaurantId: 'r-malee', name: 'ชาไทยเย็น', price: 2500, category: 'drink', isAvailable: true },
  { id: 'm-malee-5', restaurantId: 'r-malee', name: 'ข้าวหมูทอด (หมด)', price: 5000, category: 'rice', isAvailable: false },
  // ส้มตำแซ่บนัว (somtam)
  { id: 'm-somtam-1', restaurantId: 'r-somtam', name: 'ส้มตำไทย', price: 4000, category: 'somtam', isAvailable: true },
  { id: 'm-somtam-2', restaurantId: 'r-somtam', name: 'ไก่ย่าง', price: 6500, category: 'somtam', isAvailable: true },
  { id: 'm-somtam-3', restaurantId: 'r-somtam', name: 'ข้าวเหนียว', price: 1000, category: 'rice', isAvailable: true },
  { id: 'm-somtam-4', restaurantId: 'r-somtam', name: 'น้ำมะพร้าว', price: 3000, category: 'drink', isAvailable: true },
  // ก๋วยเตี๋ยวเรือ (noodle, ร้านปิด — มีเมนูไว้ทดสอบสถานะปิด)
  { id: 'm-closed-1', restaurantId: 'r-closed', name: 'ก๋วยเตี๋ยวเรือหมู', price: 5000, category: 'noodle', isAvailable: true },
  { id: 'm-closed-2', restaurantId: 'r-closed', name: 'เกาเหลา', price: 5500, category: 'noodle', isAvailable: true },
];
```

เพิ่ม import ที่หัวไฟล์: `import type { Account, Restaurant, MenuItem } from '../types';`

- [ ] **Step 5: Run test + tsc** — `npx jest seed.test && npx tsc --noEmit` → PASS + สะอาด

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/data/types/index.ts apps/mobile/src/data/mock/seed.ts apps/mobile/__tests__/data/seed.test.ts
git commit -m "feat(customer): add MenuItem + Restaurant catalog fields + menu seed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: CatalogRepo.getMenu + OrderRepo.create guard

**Files:**
- Modify: `apps/mobile/src/data/repositories/index.ts` (เพิ่ม `getMenu` ใน `CatalogRepo`)
- Modify: `apps/mobile/src/data/mock/index.ts` (implement `getMenu`; wire guard ใน `create`)
- Modify: `apps/mobile/src/data/http/index.ts` (เพิ่ม stub `getMenu`)
- Test: `apps/mobile/__tests__/data/mockRepos.test.ts` (เพิ่ม cases)

**Interfaces:**
- Consumes: `MenuItem`, `seedMenuItems`, `canOrderFromRestaurant` (จาก `../../lib/rules`)
- Produces: `CatalogRepo.getMenu(restaurantId: string): Promise<MenuItem[]>` (เฉพาะ `isAvailable`); `OrderRepo.create` throw เมื่อ `!canOrderFromRestaurant(customerId, restaurant)`

- [ ] **Step 1: Write failing tests** — เพิ่มใน `apps/mobile/__tests__/data/mockRepos.test.ts` (ภายใน describe เดิม หรือ describe ใหม่ `catalog.getMenu / orders guard`):

```ts
import { createMockRepos } from '../../src/data/mock';

describe('catalog.getMenu + orders guard', () => {
  it('getMenu คืนเฉพาะเมนูที่ available ของร้านนั้น', async () => {
    const repos = createMockRepos();
    const menu = await repos.catalog.getMenu('r-malee');
    expect(menu.length).toBeGreaterThanOrEqual(1);
    expect(menu.every((m) => m.restaurantId === 'r-malee')).toBe(true);
    expect(menu.every((m) => m.isAvailable)).toBe(true);
    expect(menu.some((m) => m.id === 'm-malee-5')).toBe(false); // หมด
  });

  it('createOrder ของลูกค้าที่ไม่ใช่เจ้าของร้าน → สำเร็จ สถานะ created', async () => {
    const repos = createMockRepos();
    const order = await repos.orders.create({
      customerId: 'u-somchai', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 2 }],
      deliveryFee: 1500, serviceFee: 500,
    });
    expect(order.status).toBe('created');
    expect(order.foodTotal).toBe(10000);
  });

  it('เจ้าของร้านสั่งร้านตัวเอง → ถูกบล็อกที่ชั้น repo (throw)', async () => {
    const repos = createMockRepos();
    await expect(repos.orders.create({
      customerId: 'u-malee', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500, serviceFee: 500,
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx jest mockRepos` → FAIL (`getMenu` ไม่มี; guard ยังไม่ throw)

- [ ] **Step 3: Add `getMenu` to interface** — `repositories/index.ts` ใน `CatalogRepo` เพิ่มบรรทัด (และ import `MenuItem`):

```ts
export interface CatalogRepo {
  listRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;
  getMenu(restaurantId: string): Promise<MenuItem[]>;
}
```
แก้ import บรรทัดแรกให้รวม `MenuItem`: `import type { Account, AccountType, MenuItem, Order, OrderItem, OrderStatus, Restaurant } from '../types';`

- [ ] **Step 4: Implement in mock** — `mock/index.ts`:
  - เพิ่ม import: `import { seedAccounts, seedRestaurants, seedMenuItems, MOCK_PASSWORD } from './seed';` และ `import { canOrderFromRestaurant } from '../../lib/rules';`
  - เพิ่ม state: `const menuItems: MenuItem[] = seedMenuItems.map((m) => ({ ...m }));` (import type `MenuItem`)
  - ใน `catalog` เพิ่ม method:

```ts
      async getMenu(restaurantId) {
        await delay();
        return menuItems.filter((m) => m.restaurantId === restaurantId && m.isAvailable).map((m) => ({ ...m }));
      },
```
  - ใน `orders.create` เพิ่ม guard ก่อนสร้าง order (หลัง `await delay();`):

```ts
        const restaurant = restaurants.find((r) => r.id === input.restaurantId);
        if (!restaurant || !canOrderFromRestaurant(input.customerId, restaurant)) {
          throw new Error('order.error.ownRestaurant');
        }
```

- [ ] **Step 5: Add http stub** — `http/index.ts` ใน `catalog` เพิ่ม: `getMenu: nope('catalog.getMenu'),`

- [ ] **Step 6: Run → PASS + tsc** — `npx jest && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/data apps/mobile/__tests__/data/mockRepos.test.ts
git commit -m "feat(customer): CatalogRepo.getMenu + wire anti-fraud guard into OrderRepo.create

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Cart store + pricing + formatBaht

**Files:**
- Create: `apps/mobile/src/features/cart/cartStore.ts`
- Create: `apps/mobile/src/features/cart/pricing.ts`
- Create: `apps/mobile/src/lib/format.ts`
- Test: `apps/mobile/__tests__/features/cartStore.test.ts`, `apps/mobile/__tests__/features/pricing.test.ts`, `apps/mobile/__tests__/lib/format.test.ts`

**Interfaces (produces):**
- `useCartStore` (zustand): state `{ restaurantId: string|null; lines: CartLine[] }`, actions `addItem(restaurantId, item: MenuItem)`, `removeItem(menuItemId)`, `setQuantity(menuItemId, qty)`, `clear()`, selector `foodTotal(): number`
- `CartLine = { menuItemId; name; unitPrice; quantity }`
- `pricing.ts`: `DELIVERY_FEE=1500`, `SERVICE_FEE=500`, `orderTotals(foodTotal) => { foodTotal, deliveryFee, serviceFee, grandTotal }`
- `format.ts`: `formatBaht(satang: number): string` → `"฿50"` / `"฿12.50"`

- [ ] **Step 1: Write failing tests**

`__tests__/lib/format.test.ts`:
```ts
import { formatBaht } from '../../src/lib/format';
describe('formatBaht', () => {
  it('สตางค์ลงตัวเป็นบาทไม่มีทศนิยม', () => { expect(formatBaht(5000)).toBe('฿50'); });
  it('มีเศษสตางค์แสดง 2 ตำแหน่ง', () => { expect(formatBaht(1250)).toBe('฿12.50'); });
  it('ศูนย์', () => { expect(formatBaht(0)).toBe('฿0'); });
});
```

`__tests__/features/pricing.test.ts`:
```ts
import { orderTotals, DELIVERY_FEE, SERVICE_FEE } from '../../src/features/cart/pricing';
describe('orderTotals', () => {
  it('แยกสามค่าและรวมถูก', () => {
    const t = orderTotals(10000);
    expect(t).toEqual({ foodTotal: 10000, deliveryFee: DELIVERY_FEE, serviceFee: SERVICE_FEE, grandTotal: 12000 });
  });
});
```

`__tests__/features/cartStore.test.ts`:
```ts
import { useCartStore } from '../../src/features/cart/cartStore';
import type { MenuItem } from '../../src/data/types';

const item = (id: string, price: number): MenuItem =>
  ({ id, restaurantId: 'r-malee', name: id, price, category: 'rice', isAvailable: true });

beforeEach(() => { useCartStore.getState().clear(); });

describe('cartStore', () => {
  it('addItem ตั้ง restaurantId และเพิ่ม quantity เมื่อเพิ่มซ้ำ', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    s.addItem('r-malee', item('m1', 5000));
    const st = useCartStore.getState();
    expect(st.restaurantId).toBe('r-malee');
    expect(st.lines).toHaveLength(1);
    expect(st.lines[0].quantity).toBe(2);
    expect(st.foodTotal()).toBe(10000);
  });

  it('setQuantity <=0 ลบรายการ', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    s.setQuantity('m1', 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('เพิ่มจากร้านอื่นโดยไม่ clear ก่อน → throw (กันตะกร้าปนร้าน)', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    expect(() => useCartStore.getState().addItem('r-somtam', item('m9', 4000))).toThrow();
  });

  it('clear แล้วเพิ่มร้านใหม่ได้', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    s.clear();
    useCartStore.getState().addItem('r-somtam', item('m9', 4000));
    expect(useCartStore.getState().restaurantId).toBe('r-somtam');
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx jest format pricing cartStore`

- [ ] **Step 3: Implement `format.ts`**

```ts
/** แปลงสตางค์เป็นบาทสำหรับแสดงผล — ลงตัวไม่โชว์ทศนิยม มีเศษโชว์ 2 ตำแหน่ง */
export function formatBaht(satang: number): string {
  const baht = satang / 100;
  const s = Number.isInteger(baht) ? String(baht) : baht.toFixed(2);
  return `฿${s}`;
}
```

- [ ] **Step 4: Implement `pricing.ts`**

```ts
export const DELIVERY_FEE = 1500; // ฿15 สตางค์ (mock คงที่ slice นี้)
export const SERVICE_FEE = 500;   // ฿5

export function orderTotals(foodTotal: number) {
  return {
    foodTotal,
    deliveryFee: DELIVERY_FEE,
    serviceFee: SERVICE_FEE,
    grandTotal: foodTotal + DELIVERY_FEE + SERVICE_FEE,
  };
}
```

- [ ] **Step 5: Implement `cartStore.ts`**

```ts
import { create } from 'zustand';
import type { MenuItem } from '../../data/types';

export type CartLine = { menuItemId: string; name: string; unitPrice: number; quantity: number };

type CartState = {
  restaurantId: string | null;
  lines: CartLine[];
  addItem: (restaurantId: string, item: MenuItem) => void;
  removeItem: (menuItemId: string) => void;
  setQuantity: (menuItemId: string, qty: number) => void;
  clear: () => void;
  foodTotal: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  restaurantId: null,
  lines: [],

  addItem(restaurantId, item) {
    const { restaurantId: current, lines } = get();
    if (current && current !== restaurantId) {
      // กันตะกร้าปนร้าน — UI ต้อง clear() ก่อน (แสดง confirm) แล้วค่อยเรียกใหม่
      throw new Error('cart.differentRestaurant');
    }
    const existing = lines.find((l) => l.menuItemId === item.id);
    const nextLines = existing
      ? lines.map((l) => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l))
      : [...lines, { menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: 1 }];
    set({ restaurantId, lines: nextLines });
  },

  removeItem(menuItemId) {
    const lines = get().lines.filter((l) => l.menuItemId !== menuItemId);
    set({ lines, restaurantId: lines.length ? get().restaurantId : null });
  },

  setQuantity(menuItemId, qty) {
    if (qty <= 0) { get().removeItem(menuItemId); return; }
    set({ lines: get().lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: qty } : l)) });
  },

  clear() { set({ restaurantId: null, lines: [] }); },

  foodTotal() { return get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0); },
}));
```

- [ ] **Step 6: Run → PASS + tsc** — `npx jest && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/cart apps/mobile/src/lib/format.ts apps/mobile/__tests__/features/cartStore.test.ts apps/mobile/__tests__/features/pricing.test.ts apps/mobile/__tests__/lib/format.test.ts
git commit -m "feat(customer): single-restaurant cart store + pricing + formatBaht

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Query hooks + filterApproved helper

**Files:**
- Create: `apps/mobile/src/features/customer/hooks.ts`
- Test: `apps/mobile/__tests__/features/customerHooks.test.ts`

**Interfaces (produces):**
- `filterApproved(list: Restaurant[]): Restaurant[]` (pure, เฉพาะ `isApproved`)
- `useRestaurants()` → `UseQueryResult<Restaurant[]>` (กรอง approved แล้ว)
- `useRestaurant(id: string)` → `UseQueryResult<Restaurant | null>`
- `useMenu(restaurantId: string)` → `UseQueryResult<MenuItem[]>`
- `useCreateOrder()` → `UseMutationResult<Order, Error, CreateOrderInput>`

- [ ] **Step 1: Write failing test** (ทดสอบ pure helper — hooks integration ทดสอบผ่าน screen tests)

```ts
import { filterApproved } from '../../src/features/customer/hooks';
import type { Restaurant } from '../../src/data/types';

const r = (id: string, isApproved: boolean): Restaurant =>
  ({ id, ownerUserId: 'x', name: id, isApproved, isOpen: true, cuisine: 'rice', distanceKm: 1, prepTimeMinutes: 10 });

describe('filterApproved', () => {
  it('คืนเฉพาะร้านที่อนุมัติแล้ว', () => {
    const out = filterApproved([r('a', true), r('b', false), r('c', true)]);
    expect(out.map((x) => x.id)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx jest customerHooks`

- [ ] **Step 3: Implement `hooks.ts`**

```ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { repos } from '../../data';
import type { Restaurant } from '../../data/types';
import type { CreateOrderInput } from '../../data/repositories';

export function filterApproved(list: Restaurant[]): Restaurant[] {
  return list.filter((r) => r.isApproved);
}

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => filterApproved(await repos.catalog.listRestaurants()),
  });
}

export function useRestaurant(id: string) {
  return useQuery({ queryKey: ['restaurant', id], queryFn: () => repos.catalog.getRestaurant(id) });
}

export function useMenu(restaurantId: string) {
  return useQuery({ queryKey: ['menu', restaurantId], queryFn: () => repos.catalog.getMenu(restaurantId) });
}

export function useCreateOrder() {
  return useMutation({ mutationFn: (input: CreateOrderInput) => repos.orders.create(input) });
}
```

- [ ] **Step 4: Run → PASS + tsc** — `npx jest customerHooks && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/customer/hooks.ts apps/mobile/__tests__/features/customerHooks.test.ts
git commit -m "feat(customer): TanStack Query hooks + filterApproved helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Navigation shell — CustomerStack + 5 minimal screens + RootNavigator wiring

**Files:**
- Create: `apps/mobile/src/app/navigators/CustomerStack.tsx` (param list + navigator + minimal screens inline import)
- Create: `apps/mobile/src/features/customer/screens/CustomerHomeScreen.tsx`
- Create: `apps/mobile/src/features/customer/screens/RestaurantDetailScreen.tsx`
- Create: `apps/mobile/src/features/customer/screens/CartScreen.tsx`
- Create: `apps/mobile/src/features/customer/screens/CheckoutScreen.tsx`
- Create: `apps/mobile/src/features/customer/screens/OrderPlacedScreen.tsx`
- Modify: `apps/mobile/src/app/RootNavigator.tsx`
- Modify: `apps/mobile/src/i18n/locales/th.json` + `en.json`
- Modify: `apps/mobile/__tests__/app/RootNavigator.test.tsx` (3 บรรทัด: `stack-customer` → `screen-customer-home`)

**Interfaces (produces):**
- `CustomerStackParamList = { CustomerHome: undefined; RestaurantDetail: { restaurantId: string }; Cart: undefined; Checkout: undefined; OrderPlaced: { orderId: string } }`
- `CustomerStack` component (default export ของ navigator)
- testIDs: `screen-customer-home`, `screen-restaurant-detail`, `screen-cart`, `screen-checkout`, `screen-order-placed`

- [ ] **Step 1: Update RootNavigator test** — ใน `__tests__/app/RootNavigator.test.tsx` แทน `'stack-customer'` ด้วย `'screen-customer-home'` ทั้ง 3 จุด (บรรทัด 84, 97 = `expectPresent`; บรรทัด 105 = `expectAbsent`). *(นี่คือ "failing test" ของ task นี้ — customer stack ยังเป็น placeholder จึงยังไม่มี `screen-customer-home`)*

- [ ] **Step 2: Run → FAIL** — `npx jest RootNavigator` → FAIL (ไม่พบ `screen-customer-home`)

- [ ] **Step 3: Add i18n keys** — ใน `th.json` เพิ่ม object `customer` (ระดับเดียวกับ `auth`) และ key `order`:

```json
  "customer": {
    "home": { "title": "ร้านใกล้คุณ", "nearby": "ร้านใกล้คุณ", "categoryAll": "ทั้งหมด", "open": "เปิด", "closed": "ปิด", "minutes": "นาที", "km": "กม.", "announcement": "เปิดให้บริการย่านใหม่แล้ว 🎉 สั่งได้เลยวันนี้", "empty": "ยังไม่มีร้านในโซนนี้" },
    "restaurant": { "closed": "ร้านปิดอยู่", "menu": "เมนู", "add": "เพิ่ม", "viewCart": "ดูตะกร้า", "items": "รายการ", "differentTitle": "เริ่มตะกร้าใหม่?", "differentBody": "ตะกร้ามีของจากร้านอื่นอยู่ ต้องล้างก่อนสั่งร้านนี้", "clearAndAdd": "ล้างแล้วเพิ่ม", "cancel": "ยกเลิก" },
    "cart": { "title": "ตะกร้า", "empty": "ตะกร้าว่าง", "foodTotal": "ค่าอาหาร", "deliveryFee": "ค่าจัดส่ง", "serviceFee": "ค่าบริการ", "grandTotal": "รวมทั้งหมด", "placeOrder": "สั่งเลย", "remove": "ลบ" },
    "checkout": { "title": "ชำระเงิน", "payWithPromptPay": "ชำระด้วยพร้อมเพย์", "scanToPay": "สแกน QR เพื่อชำระเงิน (ตัวอย่าง)", "amount": "ยอดชำระ", "confirmPay": "ยืนยันชำระเงิน" },
    "orderPlaced": { "title": "สั่งอาหารสำเร็จ", "body": "ร้านกำลังเตรียมอาหารของคุณ", "orderNo": "เลขที่ออร์เดอร์", "backHome": "กลับหน้าแรก" }
  },
  "order": { "error": { "ownRestaurant": "สั่งอาหารจากร้านของตัวเองไม่ได้" } }
```

และใน `en.json` (key เดียวกัน):

```json
  "customer": {
    "home": { "title": "Restaurants near you", "nearby": "Near you", "categoryAll": "All", "open": "Open", "closed": "Closed", "minutes": "min", "km": "km", "announcement": "Now serving a new neighbourhood 🎉 Order today", "empty": "No restaurants in this zone yet" },
    "restaurant": { "closed": "Closed now", "menu": "Menu", "add": "Add", "viewCart": "View cart", "items": "items", "differentTitle": "Start a new cart?", "differentBody": "Your cart has items from another restaurant. Clear it to order from here.", "clearAndAdd": "Clear & add", "cancel": "Cancel" },
    "cart": { "title": "Cart", "empty": "Your cart is empty", "foodTotal": "Food total", "deliveryFee": "Delivery fee", "serviceFee": "Service fee", "grandTotal": "Total", "placeOrder": "Place order", "remove": "Remove" },
    "checkout": { "title": "Checkout", "payWithPromptPay": "Pay with PromptPay", "scanToPay": "Scan the QR to pay (mock)", "amount": "Amount due", "confirmPay": "Confirm payment" },
    "orderPlaced": { "title": "Order placed", "body": "The restaurant is preparing your food", "orderNo": "Order number", "backHome": "Back to home" }
  },
  "order": { "error": { "ownRestaurant": "You can't order from your own restaurant" } }
```

- [ ] **Step 4: Create 5 minimal screens** — แต่ละไฟล์เป็น SafeAreaView + testID + หัวข้อ (จะ flesh ใน Task 6-9). ตัวอย่าง `CustomerHomeScreen.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CustomerHome'>;

export function CustomerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView testID="screen-customer-home" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View style={{ padding: p.space.xl }}>
        <Text variant="h1">{t('customer.home.title')}</Text>
      </View>
    </SafeAreaView>
  );
}
```
สร้างอีก 4 ไฟล์แบบเดียวกัน เปลี่ยน testID/หัวข้อ/generic param: `RestaurantDetailScreen` (`screen-restaurant-detail`, `'RestaurantDetail'`, `t('customer.restaurant.menu')`), `CartScreen` (`screen-cart`, `'Cart'`, `t('customer.cart.title')`), `CheckoutScreen` (`screen-checkout`, `'Checkout'`, `t('customer.checkout.title')`), `OrderPlacedScreen` (`screen-order-placed`, `'OrderPlaced'`, `t('customer.orderPlaced.title')`).

- [ ] **Step 5: Create `CustomerStack.tsx`**

```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { CustomerHomeScreen } from '../../features/customer/screens/CustomerHomeScreen';
import { RestaurantDetailScreen } from '../../features/customer/screens/RestaurantDetailScreen';
import { CartScreen } from '../../features/customer/screens/CartScreen';
import { CheckoutScreen } from '../../features/customer/screens/CheckoutScreen';
import { OrderPlacedScreen } from '../../features/customer/screens/OrderPlacedScreen';

export type CustomerStackParamList = {
  CustomerHome: undefined;
  RestaurantDetail: { restaurantId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderPlaced: { orderId: string };
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export function CustomerStack() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: tokens.bgSurface },
        headerTintColor: tokens.textPrimary,
        headerTitleStyle: { color: tokens.textPrimary },
      }}
    >
      <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={{ title: t('customer.restaurant.menu') }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: t('customer.cart.title') }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: t('customer.checkout.title') }} />
      <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} options={{ headerShown: false, gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 6: Wire RootNavigator** — `RootNavigator.tsx`: เพิ่ม `import { CustomerStack } from './navigators/CustomerStack';` แล้วแก้ `case 'customer':` เป็น `return <CustomerStack />;` (ลบ PlaceholderStack customer). *(PlaceholderStack ยังใช้กับ admin/rider/merchant — คง import ไว้)*

- [ ] **Step 7: Run → PASS + tsc** — `npx jest && npx tsc --noEmit` (RootNavigator + App tests เขียว; parity `translate.test` เขียว)

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/app apps/mobile/src/features/customer/screens apps/mobile/src/i18n apps/mobile/__tests__/app/RootNavigator.test.tsx
git commit -m "feat(customer): CustomerStack navigator shell + wire into RootNavigator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: CustomerHomeScreen (categories + restaurant cards)

**Files:**
- Modify: `apps/mobile/src/features/customer/screens/CustomerHomeScreen.tsx`
- Create: `apps/mobile/__tests__/app/CustomerHome.test.tsx`

**Interfaces:**
- Consumes: `useRestaurants`, `formatBaht`, `CustomerStackParamList`
- Produces: card testID `restaurant-card-<id>` (pressable → `navigation.navigate('RestaurantDetail', { restaurantId: id })`); category chip testID `chip-<category>`

- [ ] **Step 1: Write failing test** — `__tests__/app/CustomerHome.test.tsx` (mount ใน `QueryClientProvider` + `ThemeProvider`; รอ query resolve ด้วย loop):

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CustomerHomeScreen } from '../../src/features/customer/screens/CustomerHomeScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

beforeAll(async () => { await initI18n(); });
let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => { act(() => { r?.unmount(); }); r = null; });

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() { for (let i = 0; i < 10; i++) { await act(async () => { await new Promise((res) => setTimeout(res, 5)); }); } }

function render(nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <CustomerHomeScreen
              navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'CustomerHome'>['navigation']}
              route={{ key: 'k', name: 'CustomerHome' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('CustomerHomeScreen', () => {
  it('แสดงร้าน approved และซ่อนร้านที่ยังไม่อนุมัติ', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    expect(findAll(result.root, 'restaurant-card-r-malee').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'restaurant-card-r-somtam').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'restaurant-card-r-pending').length).toBe(0);
  });

  it('กดการ์ดร้าน → navigate ไป RestaurantDetail พร้อม restaurantId', async () => {
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => { findAll(result.root, 'restaurant-card-r-malee')[0].props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('RestaurantDetail', { restaurantId: 'r-malee' });
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx jest CustomerHome`

- [ ] **Step 3: Implement screen** — แทน `CustomerHomeScreen.tsx` ทั้งไฟล์:

```tsx
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { useRestaurants } from '../hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { CuisineCategory, Restaurant } from '../../../data/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CustomerHome'>;
const CATEGORIES: (CuisineCategory | 'all')[] = ['all', 'rice', 'noodle', 'somtam', 'drink', 'dessert'];

export function CustomerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurants = [] } = useRestaurants();
  const [cat, setCat] = useState<CuisineCategory | 'all'>('all');

  const shown = cat === 'all' ? restaurants : restaurants.filter((r) => r.cuisine === cat);

  return (
    <SafeAreaView testID="screen-customer-home" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg }} showsVerticalScrollIndicator={false}>
        <Text variant="h1">{t('customer.home.title')}</Text>

        {/* แบนเนอร์ประกาศ (ข้อมูลล้วน ห้ามส่วนลด) */}
        <View style={{ backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg }}>
          <Text variant="small" color="muted">{t('customer.home.announcement')}</Text>
        </View>

        {/* ชิปหมวดหมู่ */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: p.space.sm }}>
          {CATEGORIES.map((c) => {
            const active = c === cat;
            return (
              <Pressable
                key={c}
                testID={`chip-${c}`}
                onPress={() => setCat(c)}
                hitSlop={6}
                style={{
                  paddingHorizontal: p.space.lg, paddingVertical: p.space.sm, borderRadius: p.radius.full,
                  backgroundColor: active ? tokens.brandSolid : tokens.bgRaised,
                  borderWidth: 1, borderColor: active ? tokens.brandSolid : tokens.borderSubtle,
                }}
              >
                <Text variant="small" color={active ? 'onBrand' : 'primary'}>
                  {c === 'all' ? t('customer.home.categoryAll') : t(`customer.cuisine.${c}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {shown.length === 0 ? (
          <Text variant="body" color="muted">{t('customer.home.empty')}</Text>
        ) : (
          shown.map((r) => <RestaurantCard key={r.id} r={r} onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: r.id })} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RestaurantCard({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={`restaurant-card-${r.id}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: tokens.bgRaised, borderRadius: p.radius.lg, borderWidth: 1, borderColor: tokens.borderSubtle,
        padding: p.space.lg, opacity: pressed ? 0.9 : r.isOpen ? 1 : 0.6, gap: p.space.xs,
      })}
    >
      <View style={{ height: 96, borderRadius: p.radius.md, backgroundColor: tokens.brandAccent, opacity: 0.18 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="h3">{r.name}</Text>
        <Text variant="caption" color={r.isOpen ? 'brand' : 'muted'}>
          {r.isOpen ? t('customer.home.open') : t('customer.home.closed')}
        </Text>
      </View>
      <Text variant="small" color="muted">
        {t(`customer.cuisine.${r.cuisine}`)} · {r.distanceKm} {t('customer.home.km')} · {r.prepTimeMinutes} {t('customer.home.minutes')}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Add cuisine i18n keys** — เพิ่มใน `customer` object ทั้ง th/en (การ์ด+ชิปใช้ `customer.cuisine.<c>`):

th: `"cuisine": { "rice": "ข้าว", "noodle": "ก๋วยเตี๋ยว", "somtam": "ส้มตำ", "drink": "เครื่องดื่ม", "dessert": "ของหวาน" }`
en: `"cuisine": { "rice": "Rice", "noodle": "Noodles", "somtam": "Somtam", "drink": "Drinks", "dessert": "Dessert" }`

- [ ] **Step 5: Run → PASS + tsc** — `npx jest && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/customer/screens/CustomerHomeScreen.tsx apps/mobile/src/i18n apps/mobile/__tests__/app/CustomerHome.test.tsx
git commit -m "feat(customer): home screen with category filter + restaurant cards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: RestaurantDetailScreen (menu + add to cart + floating cart bar)

**Files:**
- Modify: `apps/mobile/src/features/customer/screens/RestaurantDetailScreen.tsx`
- Create: `apps/mobile/__tests__/app/RestaurantDetail.test.tsx`

**Interfaces:**
- Consumes: `useRestaurant`, `useMenu`, `useCartStore`, `formatBaht`
- Produces: add button testID `add-<menuItemId>`; floating bar testID `cart-bar` (→ `navigation.navigate('Cart')`); cross-restaurant confirm modal testID `confirm-different`

- [ ] **Step 1: Write failing test** — `__tests__/app/RestaurantDetail.test.tsx` (reset cart ก่อน; mount เหมือน Task 6 แต่ route param `{ restaurantId: 'r-malee' }`):

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RestaurantDetailScreen } from '../../src/features/customer/screens/RestaurantDetailScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

beforeAll(async () => { await initI18n(); });
beforeEach(() => { useCartStore.getState().clear(); });
let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => { act(() => { r?.unmount(); }); r = null; });
function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) { return root.findAll((n) => n.props?.testID === id); }
async function flush() { for (let i = 0; i < 10; i++) { await act(async () => { await new Promise((res) => setTimeout(res, 5)); }); } }

function render(restaurantId: string, nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}><ThemeProvider forceScheme="light"><NavigationContainer>
        <RestaurantDetailScreen
          navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'RestaurantDetail'>['navigation']}
          route={{ key: 'k', name: 'RestaurantDetail', params: { restaurantId } } as never}
        />
      </NavigationContainer></ThemeProvider></QueryClientProvider>,
    );
  });
  return r!;
}

describe('RestaurantDetailScreen', () => {
  it('เพิ่มเมนูลงตะกร้าแล้วแถบตะกร้าโผล่', async () => {
    const result = render('r-malee', { navigate: jest.fn() });
    await flush();
    expect(findAll(result.root, 'cart-bar').length).toBe(0);
    act(() => { findAll(result.root, 'add-m-malee-1')[0].props.onPress(); });
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(findAll(result.root, 'cart-bar').length).toBeGreaterThanOrEqual(1);
  });

  it('กดแถบตะกร้า → navigate ไป Cart', async () => {
    const navigate = jest.fn();
    const result = render('r-malee', { navigate });
    await flush();
    act(() => { findAll(result.root, 'add-m-malee-1')[0].props.onPress(); });
    act(() => { findAll(result.root, 'cart-bar')[0].props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('Cart');
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx jest RestaurantDetail`

- [ ] **Step 3: Implement screen** — แทน `RestaurantDetailScreen.tsx` ทั้งไฟล์:

```tsx
import React, { useState } from 'react';
import { View, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { useRestaurant, useMenu } from '../hooks';
import { useCartStore } from '../../cart/cartStore';
import { formatBaht } from '../../../lib/format';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { MenuItem } from '../../../data/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'RestaurantDetail'>;

export function RestaurantDetailScreen({ navigation, route }: Props) {
  const { restaurantId } = route.params;
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: menu = [] } = useMenu(restaurantId);
  const cart = useCartStore();
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  const canOrder = restaurant?.isOpen ?? false;
  const lineCount = cart.restaurantId === restaurantId ? cart.lines.reduce((s, l) => s + l.quantity, 0) : 0;

  function tryAdd(item: MenuItem) {
    if (cart.restaurantId && cart.restaurantId !== restaurantId) { setPendingItem(item); return; }
    cart.addItem(restaurantId, item);
  }
  function confirmDifferent() {
    if (!pendingItem) return;
    cart.clear();
    cart.addItem(restaurantId, pendingItem);
    setPendingItem(null);
  }

  return (
    <SafeAreaView testID="screen-restaurant-detail" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.md, paddingBottom: 96 }}>
        <Text variant="h1">{restaurant?.name ?? ''}</Text>
        {!canOrder ? <Text variant="small" style={{ color: tokens.danger }}>{t('customer.restaurant.closed')}</Text> : null}
        <Text variant="h3" style={{ marginTop: p.space.sm }}>{t('customer.restaurant.menu')}</Text>

        {menu.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md, backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg }}>
            <View style={{ flex: 1 }}>
              <Text variant="body">{item.name}</Text>
              {item.description ? <Text variant="caption" color="muted">{item.description}</Text> : null}
              <Text variant="small" color="muted">{formatBaht(item.price)}</Text>
            </View>
            <Pressable
              testID={`add-${item.id}`}
              disabled={!canOrder}
              onPress={() => tryAdd(item)}
              hitSlop={8}
              style={{ minWidth: 44, minHeight: 44, borderRadius: p.radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: canOrder ? tokens.brandSolid : tokens.borderSubtle, paddingHorizontal: p.space.lg }}
            >
              <Text variant="small" color={canOrder ? 'onBrand' : 'muted'}>{t('customer.restaurant.add')}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {lineCount > 0 ? (
        <Pressable
          testID="cart-bar"
          onPress={() => navigation.navigate('Cart')}
          style={{ position: 'absolute', left: p.space.xl, right: p.space.xl, bottom: p.space.xl, minHeight: 52, borderRadius: p.radius.md, backgroundColor: tokens.brandSolid, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: p.space.xl }}
        >
          <Text variant="body" color="onBrand">{t('customer.restaurant.viewCart')} · {lineCount} {t('customer.restaurant.items')}</Text>
          <Text variant="body" color="onBrand" style={{ fontFamily: p.fontFamily.bodyBold }}>{formatBaht(cart.foodTotal())}</Text>
        </Pressable>
      ) : null}

      <Modal visible={pendingItem !== null} transparent animationType="fade" onRequestClose={() => setPendingItem(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: p.space.xl }}>
          <View testID="confirm-different" style={{ backgroundColor: tokens.bgRaised, borderRadius: p.radius.lg, padding: p.space.xl, gap: p.space.md }}>
            <Text variant="h3">{t('customer.restaurant.differentTitle')}</Text>
            <Text variant="body" color="muted">{t('customer.restaurant.differentBody')}</Text>
            <Button testID="confirm-clear-add" label={t('customer.restaurant.clearAndAdd')} onPress={confirmDifferent} />
            <Button testID="confirm-cancel" label={t('customer.restaurant.cancel')} variant="secondary" onPress={() => setPendingItem(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Run → PASS + tsc** — `npx jest && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/customer/screens/RestaurantDetailScreen.tsx apps/mobile/__tests__/app/RestaurantDetail.test.tsx
git commit -m "feat(customer): restaurant detail — menu, add to cart, single-restaurant guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: CartScreen (line steppers + fee breakdown + place order)

**Files:**
- Modify: `apps/mobile/src/features/customer/screens/CartScreen.tsx`
- Create: `apps/mobile/__tests__/app/Cart.test.tsx`

**Interfaces:**
- Consumes: `useCartStore`, `orderTotals`, `formatBaht`
- Produces: stepper testIDs `qty-inc-<id>` / `qty-dec-<id>`; `btn-place-order` (→ `navigation.navigate('Checkout')`); empty state testID `cart-empty`

- [ ] **Step 1: Write failing test** — `__tests__/app/Cart.test.tsx` (pre-seed cart; mount ด้วย ThemeProvider เท่านั้น — CartScreen ไม่ใช้ query):

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CartScreen } from '../../src/features/customer/screens/CartScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import type { MenuItem } from '../../src/data/types';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

const item = (id: string, price: number): MenuItem => ({ id, restaurantId: 'r-malee', name: id, price, category: 'rice', isAvailable: true });
beforeAll(async () => { await initI18n(); });
beforeEach(() => { useCartStore.getState().clear(); });
let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => { act(() => { r?.unmount(); }); r = null; });
function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) { return root.findAll((n) => n.props?.testID === id); }

function render(nav: { navigate: jest.Mock }) {
  act(() => {
    r = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light"><NavigationContainer>
        <CartScreen
          navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'Cart'>['navigation']}
          route={{ key: 'k', name: 'Cart' } as never}
        />
      </NavigationContainer></ThemeProvider>,
    );
  });
  return r!;
}

describe('CartScreen', () => {
  it('ตะกร้าว่างแสดง empty state', () => {
    const result = render({ navigate: jest.fn() });
    expect(findAll(result.root, 'cart-empty').length).toBeGreaterThanOrEqual(1);
  });

  it('เพิ่มจำนวนแล้วยอดรวมอัปเดต และกดสั่งเลย → navigate Checkout', () => {
    act(() => { useCartStore.getState().addItem('r-malee', item('m1', 5000)); });
    const navigate = jest.fn();
    const result = render({ navigate });
    act(() => { findAll(result.root, 'qty-inc-m1')[0].props.onPress(); });
    expect(useCartStore.getState().lines[0].quantity).toBe(2);
    act(() => { findAll(result.root, 'btn-place-order')[0].props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('Checkout');
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx jest Cart.test`

- [ ] **Step 3: Implement screen** — แทน `CartScreen.tsx` ทั้งไฟล์:

```tsx
import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { useCartStore } from '../../cart/cartStore';
import { orderTotals } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Cart'>;

export function CartScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const cart = useCartStore();
  const totals = orderTotals(cart.foodTotal());

  if (cart.lines.length === 0) {
    return (
      <SafeAreaView testID="screen-cart" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface, alignItems: 'center', justifyContent: 'center', padding: p.space.xl }}>
        <Text testID="cart-empty" variant="body" color="muted">{t('customer.cart.empty')}</Text>
      </SafeAreaView>
    );
  }

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" color={bold ? 'primary' : 'muted'} style={bold ? { fontFamily: p.fontFamily.bodyBold } : undefined}>{label}</Text>
      <Text variant="body" style={{ fontVariant: ['tabular-nums'], ...(bold ? { fontFamily: p.fontFamily.bodyBold } : {}) }}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView testID="screen-cart" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg }}>
        {cart.lines.map((l) => (
          <View key={l.menuItemId} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md, backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg }}>
            <View style={{ flex: 1 }}>
              <Text variant="body">{l.name}</Text>
              <Text variant="small" color="muted">{formatBaht(l.unitPrice)}</Text>
            </View>
            <Pressable testID={`qty-dec-${l.menuItemId}`} onPress={() => cart.setQuantity(l.menuItemId, l.quantity - 1)} hitSlop={8} style={{ width: 44, height: 44, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="h3">−</Text>
            </Pressable>
            <Text variant="body" style={{ minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{l.quantity}</Text>
            <Pressable testID={`qty-inc-${l.menuItemId}`} onPress={() => cart.setQuantity(l.menuItemId, l.quantity + 1)} hitSlop={8} style={{ width: 44, height: 44, borderRadius: p.radius.md, backgroundColor: tokens.brandSolid, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="h3" color="onBrand">+</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ gap: p.space.sm, marginTop: p.space.md }}>
          <Row label={t('customer.cart.foodTotal')} value={formatBaht(totals.foodTotal)} />
          <Row label={t('customer.cart.deliveryFee')} value={formatBaht(totals.deliveryFee)} />
          <Row label={t('customer.cart.serviceFee')} value={formatBaht(totals.serviceFee)} />
          <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginVertical: p.space.xs }} />
          <Row label={t('customer.cart.grandTotal')} value={formatBaht(totals.grandTotal)} bold />
        </View>

        <Button testID="btn-place-order" label={t('customer.cart.placeOrder')} onPress={() => navigation.navigate('Checkout')} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Run → PASS + tsc** — `npx jest && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/customer/screens/CartScreen.tsx apps/mobile/__tests__/app/Cart.test.tsx
git commit -m "feat(customer): cart screen — qty steppers, fee breakdown, place order

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: CheckoutScreen (PromptPay mock + createOrder guard) + OrderPlacedScreen

**Files:**
- Modify: `apps/mobile/src/features/customer/screens/CheckoutScreen.tsx`
- Modify: `apps/mobile/src/features/customer/screens/OrderPlacedScreen.tsx`
- Create: `apps/mobile/__tests__/app/Checkout.test.tsx`

**Interfaces:**
- Consumes: `useCartStore`, `useCreateOrder`, `orderTotals`, `useAuthStore` (account.id เป็น customerId), `formatBaht`
- Produces: `btn-confirm-pay` (→ createOrder → สำเร็จ: `clear()` + `navigation.replace('OrderPlaced', { orderId })`); error testID `checkout-error`; OrderPlaced `btn-back-home` (→ `navigation.popToTop()`)

- [ ] **Step 1: Write failing test** — `__tests__/app/Checkout.test.tsx` (pre-seed cart + set auth account; mount ใน QueryClientProvider):

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckoutScreen } from '../../src/features/customer/screens/CheckoutScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import type { MenuItem } from '../../src/data/types';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

const item = (id: string, price: number, rid = 'r-malee'): MenuItem => ({ id, restaurantId: rid, name: id, price, category: 'rice', isAvailable: true });
beforeAll(async () => { await initI18n(); await i18n.changeLanguage('th'); });
beforeEach(() => { useCartStore.getState().clear(); useAuthStore.setState({ account: null } as never); });
let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => { act(() => { r?.unmount(); }); r = null; });
function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) { return root.findAll((n) => n.props?.testID === id); }
async function flush() { for (let i = 0; i < 10; i++) { await act(async () => { await new Promise((res) => setTimeout(res, 5)); }); } }

function render(nav: { navigate: jest.Mock; replace: jest.Mock; popToTop: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}><ThemeProvider forceScheme="light"><NavigationContainer>
        <CheckoutScreen
          navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'Checkout'>['navigation']}
          route={{ key: 'k', name: 'Checkout' } as never}
        />
      </NavigationContainer></ThemeProvider></QueryClientProvider>,
    );
  });
  return r!;
}

describe('CheckoutScreen', () => {
  it('ลูกค้าปกติยืนยันชำระเงิน → สร้างออร์เดอร์แล้ว replace ไป OrderPlaced + ตะกร้าถูกล้าง', async () => {
    useAuthStore.setState({ account: { id: 'u-somchai' } } as never);
    act(() => { useCartStore.getState().addItem('r-malee', item('m-malee-1', 5000)); });
    const nav = { navigate: jest.fn(), replace: jest.fn(), popToTop: jest.fn() };
    const result = render(nav);
    act(() => { findAll(result.root, 'btn-confirm-pay')[0].props.onPress(); });
    await flush();
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace.mock.calls[0][0]).toBe('OrderPlaced');
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('เจ้าของร้านสั่งร้านตัวเอง → error โชว์ ไม่ replace', async () => {
    useAuthStore.setState({ account: { id: 'u-malee' } } as never);
    act(() => { useCartStore.getState().addItem('r-malee', item('m-malee-1', 5000)); });
    const nav = { navigate: jest.fn(), replace: jest.fn(), popToTop: jest.fn() };
    const result = render(nav);
    act(() => { findAll(result.root, 'btn-confirm-pay')[0].props.onPress(); });
    await flush();
    expect(nav.replace).not.toHaveBeenCalled();
    const err = findAll(result.root, 'checkout-error').find((n) => typeof n.props.children === 'string');
    expect(err?.props.children).toBe(i18n.t('order.error.ownRestaurant'));
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx jest Checkout`

- [ ] **Step 3: Implement `CheckoutScreen.tsx`** — แทนทั้งไฟล์:

```tsx
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { useCartStore } from '../../cart/cartStore';
import { orderTotals } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import { useCreateOrder } from '../hooks';
import { useAuthStore } from '../../auth/authStore';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Checkout'>;

export function CheckoutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const cart = useCartStore();
  const account = useAuthStore((s) => s.account);
  const createOrder = useCreateOrder();
  const totals = orderTotals(cart.foodTotal());
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!cart.restaurantId || !account) return;
    setError(null);
    createOrder.mutate(
      {
        customerId: account.id,
        restaurantId: cart.restaurantId,
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity })),
        deliveryFee: totals.deliveryFee,
        serviceFee: totals.serviceFee,
      },
      {
        onSuccess: (order) => { cart.clear(); navigation.replace('OrderPlaced', { orderId: order.id }); },
        onError: () => { setError('order.error.ownRestaurant'); },
      },
    );
  }

  return (
    <SafeAreaView testID="screen-checkout" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg }}>
        <Text variant="h2">{t('customer.checkout.payWithPromptPay')}</Text>

        {/* PromptPay QR แบบ mock — บล็อกลายทึบ ไม่ใช้ asset ลิขสิทธิ์จริง */}
        <View style={{ alignItems: 'center', gap: p.space.sm, backgroundColor: tokens.bgRaised, borderRadius: p.radius.lg, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.xl }}>
          <View style={{ width: 180, height: 180, borderRadius: p.radius.md, backgroundColor: tokens.textPrimary, opacity: 0.9 }} />
          <Text variant="small" color="muted">{t('customer.checkout.scanToPay')}</Text>
          <Text variant="h3">{formatBaht(totals.grandTotal)}</Text>
        </View>

        <View style={{ gap: p.space.xs }}>
          <Text variant="small" color="muted">{t('customer.checkout.amount')}: {formatBaht(totals.grandTotal)}</Text>
        </View>

        {error ? <Text testID="checkout-error" variant="small" style={{ color: tokens.danger }}>{t(error)}</Text> : null}

        <Button
          testID="btn-confirm-pay"
          label={t('customer.checkout.confirmPay')}
          disabled={createOrder.isPending || cart.lines.length === 0}
          onPress={confirm}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
```
*(หมายเหตุ `Button` กลางรองรับ `disabled` อยู่แล้ว — ดู `src/ui/Button.tsx`)*

- [ ] **Step 4: Implement `OrderPlacedScreen.tsx`** — แทนทั้งไฟล์:

```tsx
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderPlaced'>;

export function OrderPlacedScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView testID="screen-order-placed" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface, alignItems: 'center', justifyContent: 'center', padding: p.space.xl, gap: p.space.md }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: tokens.brandSolid, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="display" color="onBrand">✓</Text>
      </View>
      <Text variant="h1" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.title')}</Text>
      <Text variant="body" color="muted" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.body')}</Text>
      <Text variant="small" color="muted">{t('customer.orderPlaced.orderNo')}: {route.params.orderId}</Text>
      <Button testID="btn-back-home" label={t('customer.orderPlaced.backHome')} onPress={() => navigation.popToTop()} />
    </SafeAreaView>
  );
}
```
*(`✓` เป็น glyph ในข้อความยืนยัน ไม่ใช่ไอคอนโครงสร้าง/นำทาง — ยอมรับได้; ถ้าต้องการเลี่ยงให้ใช้บล็อกสีแทน)*

- [ ] **Step 5: Run → PASS + tsc** — `npx jest && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/customer/screens/CheckoutScreen.tsx apps/mobile/src/features/customer/screens/OrderPlacedScreen.tsx apps/mobile/__tests__/app/Checkout.test.tsx
git commit -m "feat(customer): checkout PromptPay mock + createOrder (guarded) + order placed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (against spec)

- **Spec §3 data model** → Task 1 ✓ · **§6 repo/getMenu/guard** → Task 2 ✓ · **§4 cart single-restaurant** → Task 3 ✓ · **§5 pricing/fees separate** → Task 3 ✓ · **§6 hooks** → Task 4 ✓ · **§7 nav replaces placeholder** → Task 5 ✓ · **§8 four screens + confirmation** → Tasks 5–9 ✓ · **§8 announcement info-only** → Task 6 ✓ · **§8 closed restaurant viewable, can't add** → Task 7 ✓ · **§8 fee line items** → Task 8 ✓ · **§8 PromptPay mock + guard error** → Task 9 ✓ · **§11 acceptance** → covered by tests in Tasks 2/6/7/8/9.
- **Type consistency:** `MenuItem.price` (satang) → `CartLine.unitPrice` → `OrderItem.unitPrice` consistent; `CustomerStackParamList` names match across screens + navigator; `useCreateOrder` consumes `CreateOrderInput` (existing shape, no `foodTotal` field — computed in mock) ✓.
- **Money:** all satang; `formatBaht` sole display path ✓.
- **i18n parity:** every key added to th + en together (Tasks 5, 6) — `translate.test` guards it.
- **Note:** OrderPlaced uses `navigation.replace` from Checkout (so back doesn't return to checkout) and `popToTop` to return home — verify `replace`/`popToTop` exist on native-stack navigation (they do).
