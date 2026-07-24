# Wingdai — Customer Ordering (Slice 1) Design

> ต่อยอดจาก foundation + auth (branch `feat/customer-ordering`, ฐาน 118 tests ผ่าน). อ้างอิง spec แม่ `2026-07-21-wingdai-mobile-app-design.md` §5 (data layer), §8.2 (Customer screens), §11 ขั้นที่ 4.

**Goal:** ลูกค้าเปิดแอป → เห็นร้านใกล้เคียง → เข้าร้าน → เลือกเมนู → ตะกร้า → จ่ายเงิน (PromptPay QR แบบ mock) → ได้ Order จริงในระบบ mock. ครบตามเกณฑ์ §11 ขั้น 4 "สั่งอาหารได้ครบจนถึงหน้าจ่ายเงิน".

**Slice นี้ = happy path เท่านั้น** (ตัดสินกับผู้ใช้ 2026-07-24): 4 หน้า + ต่อ data layer. เมนู **ไม่มี add-ons** ใน slice นี้.

---

## 1. ขอบเขต (4 หน้าหลัก + หน้ายืนยัน = 5 จอ)

```
CustomerHome ──▶ RestaurantDetail(restaurantId) ──▶ Cart ──▶ Checkout ──▶ OrderPlaced (สำเร็จ)
```

แทน `CustomerStack` ที่ตอนนี้เป็น `PlaceholderStack` ด้วย native-stack จริง.

---

## 2. Non-goals (เลื่อนไป slice ถัดไป — ห้ามทำใน slice นี้)

ค้นหา/กรองแยกจอ · ติดตามออร์เดอร์ + แผนที่สด (MapLibre/Protomaps) · ประวัติออร์เดอร์ · รายละเอียดออร์เดอร์ + สั่งซ้ำ · รีวิว · โปรไฟล์ + ที่อยู่ · ฟอร์มเปิดร้าน · add-ons/ตัวเลือกเมนู · ledger double-entry (§6.2) · payment gateway จริง · bottom tabs (Home/History/Profile) · Merchant/Rider/Admin stacks.

หมายเหตุ **แบนเนอร์ประกาศ** เป็นข้อมูลล้วน (เช่น "เปิดย่านใหม่แล้ว") — ห้ามมีรหัสส่วนลด/ราคาตัด/คำว่าลดราคา (spec §8.2, claude.md §2/§3).

---

## 3. ต่อ Data Model (`src/data/types/index.ts`)

ปัจจุบัน `Restaurant` มีแค่ `{ id, ownerUserId, name, isApproved, isOpen }` และ **ยังไม่มี `MenuItem`**. เพิ่ม:

```ts
export type CuisineCategory = 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert';

export interface Restaurant {            // ขยายของเดิม
  id: string;
  ownerUserId: string;
  name: string;
  isApproved: boolean;
  isOpen: boolean;
  cuisine: CuisineCategory;              // ใหม่ — ใช้กรองหมวดหมู่บนหน้า Home
  distanceKm: number;                    // ใหม่ — mock ระยะทาง (density ตาม claude.md §1)
  prepTimeMinutes: number;               // ใหม่ — ค่าคงที่ร้านตั้งเอง (§6.3 seed cold-start)
}

export interface MenuItem {              // ใหม่
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number;                         // สตางค์ (claude.md §7)
  category: CuisineCategory;
  isAvailable: boolean;
}
```

`Order` / `OrderItem` เดิมใช้ได้เลย (สตางค์, แยก foodTotal/deliveryFee/serviceFee).

**Seed (`src/data/mock/seed.ts`):** เพิ่ม field ใหม่ให้ 3 ร้าน approved เดิม (`r-malee`, `r-somtam`, `r-closed`) + เพิ่ม `seedMenuItems: MenuItem[]` (แต่ละร้าน 3–5 เมนู หลายหมวด). ร้าน `r-closed` มีเมนูได้แต่ `isOpen: false` (ใช้ทดสอบสถานะปิด). ร้าน `r-pending` (`isApproved:false`) ต้องไม่โผล่บน Home.

---

## 4. Cart (client state — Zustand `src/features/cart/cartStore.ts`)

```ts
type CartLine = { menuItemId: string; name: string; unitPrice: number; quantity: number };
type CartState = {
  restaurantId: string | null;          // ตะกร้าผูกร้านเดียว
  lines: CartLine[];
  addItem(restaurantId: string, item: MenuItem): void;  // ต่างร้าน → ต้อง clear ก่อน
  removeItem(menuItemId: string): void;
  setQuantity(menuItemId: string, qty: number): void;    // qty<=0 = ลบ
  clear(): void;
  foodTotal(): number;                  // สตางค์
};
```

**กฎร้านเดียว (ชัดเจน/เทสต์ได้):** store `addItem(restaurantId, item)` — ถ้า `state.restaurantId` เป็น null หรือ === restaurantId → เพิ่มปกติ (ตั้ง restaurantId ครั้งแรก); ถ้า `state.restaurantId && !== restaurantId` → **throw** (defensive, ป้องกันตะกร้าปนร้าน). UI หน้า RestaurantDetail ตรวจ `cart.restaurantId` เองก่อนเพิ่ม: ต่างร้าน → แสดง confirm "ล้างตะกร้าเดิม?" → กดยืนยันจึง `clear()` แล้ว `addItem` (ไม่ล้างเงียบ ๆ). เทสต์ยืนยัน throw เมื่อเพิ่มต่างร้านโดยไม่ clear.

---

## 5. Pricing (`src/features/cart/pricing.ts`)

```ts
export const DELIVERY_FEE = 1500;   // ฿15 สตางค์ (mock คงที่ slice นี้)
export const SERVICE_FEE  = 500;    // ฿5
export function orderTotals(foodTotal: number) {
  return { foodTotal, deliveryFee: DELIVERY_FEE, serviceFee: SERVICE_FEE,
           grandTotal: foodTotal + DELIVERY_FEE + SERVICE_FEE };
}
```

แยก 3 ค่าเสมอ ห้ามรวบเป็นก้อนเดียว (claude.md §3 หลักการ 2). **ราคาเมนู = ราคาหน้าร้าน ห้ามบวก markup** — ค่าธรรมเนียมเป็น line item แยก. คอมมิชชั่น 15% เป็นเรื่อง ledger ไม่โชว์ลูกค้า และไม่อยู่ใน slice นี้.

---

## 6. Repo / Hooks (3 ชั้นตาม spec §5)

**Repository interface (`src/data/repositories/index.ts`):**
- `RestaurantRepo.listRestaurants(): Promise<Restaurant[]>` — คืนเฉพาะ `isApproved === true`
- `RestaurantRepo.getRestaurant(id): Promise<Restaurant | null>`
- `RestaurantRepo.getMenu(restaurantId): Promise<MenuItem[]>` — เฉพาะ `isAvailable`
- `OrderRepo.createOrder(input: CreateOrderInput): Promise<Order>`

```ts
type CreateOrderInput = {
  customerId: string; restaurantId: string;
  items: OrderItem[]; foodTotal: number; deliveryFee: number; serviceFee: number;
};
```

**Mock (`src/data/mock/index.ts`):** อ่านจาก seed. `createOrder` → สร้าง Order `status:'created'`, `id` ใหม่, `createdAt` now, เก็บใน mock store (ให้ slice ถัดไป query ได้).

**Guard กันโกง (จ่ายหนี้ tech debt):** `createOrder` เรียก `rules.ts` — ถ้า `restaurant.ownerUserId === input.customerId` → โยน error key `order.error.ownRestaurant`. บังคับที่ชั้น repo (เทียบ server-side) ไม่ใช่แค่ UI (claude.md §4.3).

**TanStack Query hooks (`src/features/customer/hooks.ts`):** `useRestaurants()`, `useRestaurant(id)`, `useMenu(restaurantId)`, `useCreateOrder()` (mutation, invalidate ที่จำเป็น).

---

## 7. Navigation (`src/app/navigators/CustomerStack.tsx`)

native-stack: `CustomerHome` (root) → `RestaurantDetail` `{ restaurantId }` → `Cart` → `Checkout` → `OrderPlaced` `{ orderId }`. RootNavigator: capability `customer` → `<CustomerStack/>` แทน placeholder. Rider ที่ approved ก็เข้าถึงผ่าน role switcher เดิม (ไม่แตะ logic นั้น).

---

## 8. รายละเอียดแต่ละหน้า

**CustomerHome** — ชิปหมวดหมู่ (all + 5 cuisine, กรอง client-side จาก `useRestaurants`) · การ์ดร้าน (`bgRaised`): ชื่อ, cuisine, badge เปิด/ปิด, `distanceKm`, `prepTimeMinutes`; ร้านปิดกดได้แต่ dim · แบนเนอร์ประกาศ (ข้อมูลล้วน) ด้านบน · ร้านปิดสั่งไม่ได้ (เข้าดูเมนูได้ แต่ปุ่มเพิ่มถูก disable).

**RestaurantDetail** — หัวร้าน (ชื่อ, cuisine, เปิด/ปิด) · เมนูจาก `useMenu` จัดกลุ่มตาม category · แถวเมนู: ชื่อ, ราคา (฿), ปุ่มเพิ่ม (disabled ถ้าร้านปิด/`!isAvailable`) · แถบลอยล่าง (opaque, ห้าม glass): "ดูตะกร้า · N รายการ · ฿xx" → Cart (โผล่เมื่อมี lines ของร้านนี้) · ถ้า addItem ต่างร้าน → confirm ล้างตะกร้า.

**Cart** — รายการ `lines`: ชื่อ, ราคาต่อหน่วย, stepper (− qty +), ปุ่มลบ · สรุป: ค่าอาหาร / ค่าส่ง ฿15 / ค่าบริการ ฿5 / รวม (tabular figures) · ปุ่ม "สั่งเลย" → Checkout · empty state ถ้าไม่มี lines.

**Checkout** — สรุปออร์เดอร์ (ร้าน + รายการ + ยอดรวม) · **PromptPay QR mock**: กล่อง QR ปลอม (บล็อกลาย + โลโก้ PromptPay placeholder ไม่ใช้ asset ลิขสิทธิ์จริง) + ยอด · ปุ่ม "ยืนยันชำระเงิน" → `useCreateOrder` (customerId = account ที่ล็อกอิน) → สำเร็จ: `clear()` cart, navigate `OrderPlaced` · error guard กันโกง → แสดง error inline.

**OrderPlaced** — ยืนยันสำเร็จ (เลข order, ยอด) · ปุ่ม "กลับหน้าแรก" (reset stack ไป Home). *(หน้าติดตามจริงอยู่ slice ถัดไป — ตอนนี้จบที่ยืนยัน)*

---

## 9. Design system / มาตรฐานเดิม

โทเคน 3 ชั้น + dark mode · `Text`/`Button` กลาง · `allowFontScaling={false}` (มีใน `Text` แล้ว; TextInput ใส่เอง) · ทุกสตริงผ่าน i18n key ใหม่ namespace `customer.*` + `order.*` (ไทย source + en) · เงินสตางค์ แสดงผลผ่าน helper `formatBaht(satang)` · **ไม่มี glass** ทุกจอใน slice นี้ (พื้นทึบ) · SafeArea + keyboard-safe ที่จอมี input.

**i18n keys ใหม่ (ย่อ):** `customer.home.{title,nearby,categoryAll,open,closed,minutes,km,announcement}`, `customer.restaurant.{closed,addToCart,viewCart,items,differentRestaurantTitle,differentRestaurantBody,clearAndAdd}`, `customer.cart.{title,empty,foodTotal,deliveryFee,serviceFee,grandTotal,placeOrder,remove}`, `customer.checkout.{title,payWithPromptPay,amount,confirmPay,scanToPay}`, `customer.orderPlaced.{title,orderNo,backHome}`, `order.error.ownRestaurant`.

---

## 10. Testing (react-test-renderer + unit — pattern เดิม `__tests__/app/RootNavigator.test.tsx`)

1. **mockRepos:** `listRestaurants` คืนเฉพาะ approved (r-pending ไม่โผล่) · `getMenu` คืนเฉพาะ available · `createOrder` สร้าง Order `created` · **guard: เจ้าของสั่งร้านตัวเอง → throw `order.error.ownRestaurant`** (เช่น malee สั่ง r-malee).
2. **cartStore:** add/remove/setQuantity, qty<=0 ลบ, กฎร้านเดียว (add ต่างร้านถูกปฏิเสธจนกว่า clear), `foodTotal` ถูกต้อง.
3. **pricing:** `orderTotals` แยก 3 ค่า + grandTotal ถูก.
4. **hooks/screens:** render 4 หน้าเจอ testID (`screen-customer-home`, `screen-restaurant-detail`, `screen-cart`, `screen-checkout`, `screen-order-placed`); Home ซ่อน r-pending; Cart ว่างโชว์ empty; กรองหมวดหมู่ทำงาน.
5. **i18n:** key parity th/en (เทสต์เดิม `translate.test.ts` ต้องยังผ่าน).

ทุก task: `npm test` (ทั้งหมด, ไม่ skip) + `npx tsc --noEmit` เขียวก่อน commit. commit conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## 11. เกณฑ์ยอมรับของ slice นี้

1. `npm test` ผ่านหมด (118 เดิม + ใหม่) ไม่ skip; `tsc` สะอาด.
2. เปิดแอปเป็น `somchai` → Home เห็นร้าน approved (ไม่เห็น r-pending) → เข้า `ครัวมาลี` → เพิ่ม 2 เมนู → Cart เห็นยอด (อาหาร + ฿15 + ฿5) → Checkout เห็น QR mock → ยืนยัน → OrderPlaced.
3. เพิ่มเมนูจากร้านอื่นทั้งที่มีของในตะกร้า → เจอ confirm ล้างตะกร้า.
4. ร้านปิด (`ก๋วยเตี๋ยวเรือ`) เข้าดูเมนูได้ แต่เพิ่มไม่ได้.
5. เจ้าของร้าน (`malee`) พยายามสั่งร้านตัวเอง → ถูกบล็อกที่ชั้น repo (error).
6. เงินทุกช่องเป็นสตางค์ภายใน แสดงผลเป็นบาทถูกต้อง แยกค่าธรรมเนียมเป็น line item.

---

## 12. คำถามเปิด (ไม่บล็อก slice นี้)
- payment gateway จริง (claude.md §11.3) — ใช้ mock ต่อ.
- รูปร้าน/เมนูจริง — slice นี้ใช้ placeholder บล็อกสีโทเคน (ไม่มี asset ลิขสิทธิ์).
