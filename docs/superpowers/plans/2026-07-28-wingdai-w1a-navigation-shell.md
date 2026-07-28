# คลื่นที่ 1A — โครง navigation ใหม่ + จอติดตามออเดอร์

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน navbar ให้ตรง design — 4 แท็บ `Home·Menu·History·Me` กับปุ่มลอย 2 ปุ่มที่โผล่ตามเงื่อนไข (แฮมเบอร์เกอร์ = มีออเดอร์ที่ยังไม่จบ, ตะกร้า = มีของในตะกร้า) แล้วต่อปุ่มแฮมเบอร์เกอร์เข้าจอติดตามออเดอร์ที่มีแผนที่จริง

**Architecture:** แก้ `WingdaiTabBar` ให้อ่านสองแหล่ง — `useActiveOrder()` (react-query) กับ `useCartStore` (zustand) — แล้ววาดปุ่มลอยแยกกันคนละเงื่อนไข ตัวตัดสินว่าออเดอร์ "ยังไม่จบ" ต้องมาจาก `orderStateMachine.ts` ไม่ใช่ลิสต์สถานะที่พิมพ์ซ้ำ จอติดตามแยกส่วนแผนที่ออกเป็น component เดี่ยว เพื่อให้ส่วนที่เหลือของจอ (ไทม์ไลน์ ยอดเงิน การ์ดร้าน) ทำงานได้แม้แผนที่ยังไม่พร้อม

**Tech Stack:** React Native 0.86 + Expo SDK 57 · React Navigation 7 · TanStack Query 5 · Zustand 5 · react-native-svg 15 · `@maplibre/maplibre-react-native` (ใหม่) · jest-expo + react-test-renderer

**อ้างอิง spec:** `docs/superpowers/specs/2026-07-28-wingdai-design-conformance-design.md` §5.1–5.3, §8 W1-0 ถึง W1-4

## Global Constraints

- **Expo v57** — อ่านเอกสารเวอร์ชันตรงที่ https://docs.expo.dev/versions/v57.0.0/ ก่อนเขียนโค้ดที่แตะ SDK (คำสั่งจาก `apps/mobile/AGENTS.md`)
- **ห้ามมี hex ดิบในไฟล์หน้าจอ** — ทุกสีมาจาก `useTheme().tokens` (ยกเว้นสีบนพื้น teal ตายตัว เช่น `'#FFFFFF'` บนแถบ nav)
- **ตัวอักษรทุกตัวผ่าน `src/ui/Text`** ไม่ใช้ `<Text>` ของ react-native ตรง ๆ
- **กฎสีส้ม 3 บทบาท ห้ามแก้** — `brandAccent` `#F15A22` กราฟิกล้วน · `brandSolid` `#CC4310` พื้นที่มีตัวหนังสือ · `brandLink` `#B23A0C` ตัวอักษรสีแบรนด์ · ห้ามแก้ `__tests__/theme/contrast.test.ts` ให้ผ่านโดยลดเกณฑ์
- **พื้นที่แตะทุกปุ่ม ≥ 44px**
- **ห้ามใส่ UI ที่กดแล้วไม่มีอะไรเกิดขึ้น**
- **ห้ามใช้ `expo-blur` บนจอที่มีแผนที่** ตาม `claude.md §10` — ใช้พื้นทึบ
- **ทุกข้อความผ่าน i18n** เพิ่มคีย์ทั้ง `th.json` และ `en.json` เสมอ
- **`lineHeight` ต้อง ≥ 1.7 × fontSize** สำหรับเนื้อความ (มีเทสต์ล็อกไว้)
- **commit message ห้ามใส่ `Co-Authored-By: Claude`** — กฎเฉพาะของ repo นี้
- รันคำสั่งทั้งหมดจาก `apps/mobile`
- เกณฑ์ผ่านทุก task: `npx jest` เขียว และ `npx tsc --noEmit` ไม่มี error

---

## File Structure

| ไฟล์ | รับผิดชอบอะไร |
|---|---|
| `docs/design/Wingdai App.dc.html` | **สร้าง** — markup อ้างอิง 58 จอ ไว้ `grep` ตอนทำแต่ละจอ |
| `apps/mobile/app.json` | **แก้** — identity ของแอป (ชื่อ, bundle id, package, scheme, โหมดสี) |
| `src/data/orderStateMachine.ts` | **แก้** — เพิ่ม `isActiveStatus()` แหล่งความจริงเดียวว่าออเดอร์จบหรือยัง |
| `src/features/customer/hooks.ts` | **แก้** — เพิ่ม `pickActiveOrder()` (pure) + `useActiveOrder()` (hook) |
| `src/ui/Icon.tsx` | **แก้** — เพิ่มไอคอน `burger` ตัวเดียว |
| `src/features/customer/screens/CategoriesScreen.tsx` | **สร้าง** — จอ C15 แท็บ Menu: กริดหมวด → รายชื่อร้านในหมวด |
| `src/app/navigators/CustomerStack.tsx` | **แก้** — ชุดแท็บใหม่, ย้าย Inbox ขึ้น stack, เพิ่ม route `OrderTracking` |
| `src/app/navigators/WingdaiTabBar.tsx` | **แก้** — ปุ่มลอย 2 ปุ่มแทนปุ่มตะกร้ากลางแถบ |
| `src/features/customer/screens/OrderTrackingScreen.tsx` | **สร้าง** — จอ C6 ประกอบร่าง |
| `src/features/customer/components/TrackingMap.tsx` | **สร้าง** — ห่อ MapLibre ไว้ที่เดียว ให้จอที่เหลือไม่ผูกกับไลบรารีแผนที่ |
| `src/i18n/locales/{th,en}.json` | **แก้** — คีย์แท็บใหม่, หมวดหมู่, จอติดตาม |

---

## Task 1: ดึงไฟล์ design ลง repo

ทุก task หลังจากนี้ที่ต้องทำ UI ให้ตรง design ต้อง `grep` จากไฟล์นี้ ทำก่อนเป็นอันดับแรก

**Files:**
- Create: `docs/design/Wingdai App.dc.html`

**Interfaces:**
- Consumes: —
- Produces: ไฟล์ HTML ที่ task อื่น `grep` หา markup ของจอที่กำลังทำ

- [ ] **Step 1: ดึงไฟล์ผ่าน DesignSync**

เรียกเครื่องมือ `DesignSync` ด้วยพารามิเตอร์:

```
method: "get_file"
projectId: "fd98a85f-d87c-482c-b7c8-cdab136afa79"
path: "Wingdai App.dc.html"
```

- [ ] **Step 2: ตรวจว่าไฟล์ครบหรือถูกตัด**

ดูค่า `truncated` ใน response

- `truncated: false` → ไปต่อ Step 3
- `truncated: true` → **หยุด** ไฟล์เกิน 256 KiB ดึงครบไม่ได้ แจ้งผู้ใช้ว่า
  "ไฟล์ใหญ่เกินโควตาของเครื่องมือ รบกวนดาวน์โหลด `Wingdai App.dc.html` จาก claude.ai
  แล้ววางไว้ที่ `docs/design/`" แล้วรอ อย่าเขียนไฟล์ที่ไม่ครบลง repo เพราะจะทำให้
  task ถัดไป `grep` ได้ markup ที่ขาดหายโดยไม่รู้ตัว

- [ ] **Step 3: เขียนลงดิสก์**

ใช้เครื่องมือ `Write` เขียนค่า `content` ที่ได้ทั้งก้อนลง `docs/design/Wingdai App.dc.html`

- [ ] **Step 4: ตรวจว่าไฟล์ใช้งานได้จริง**

```bash
cd /Users/pannatron.r/Desktop/Food_rush_project
wc -c "docs/design/Wingdai App.dc.html"
grep -c 'C1' "docs/design/Wingdai App.dc.html"
grep -o 'DELIVER TO' "docs/design/Wingdai App.dc.html" | head -1
```

คาดหวัง: ขนาด > 50000 ไบต์ · `grep -c` คืนเลขมากกว่า 0 · เจอข้อความ `DELIVER TO` (ยืนยันว่าได้ markup ของ C1 Home จริง)

- [ ] **Step 5: Commit**

```bash
git add "docs/design/Wingdai App.dc.html"
git commit -m "docs(design): เก็บ markup อ้างอิง 58 จอลง repo ไว้เทียบตอนทำ UI"
```

---

## Task 2: ตั้ง identity ของแอปใน app.json

Google OAuth client ที่ลงทะเบียนไว้ผูกกับ `com.wingdai.app` ตายตัว ถ้า `app.json` ไม่ตรง Google sign-in จะพังตอน task ของคลื่น 1C — และตอนนี้แอปยังชื่อ `mobile` ทั้งที่ `claude.md §10` สั่งให้ใช้ Wingdai ทุกที่

**Files:**
- Modify: `apps/mobile/app.json`
- Create: `apps/mobile/__tests__/app/appConfig.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `expo.scheme = "wingdai"`, `expo.ios.bundleIdentifier = "com.wingdai.app"`, `expo.android.package = "com.wingdai.app"` — คลื่น 1C ใช้ค่าเหล่านี้ตอนตั้ง Google sign-in

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `apps/mobile/__tests__/app/appConfig.test.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

const appJson = JSON.parse(readFileSync(join(__dirname, '../../app.json'), 'utf8'));

describe('app.json identity', () => {
  it('ใช้ชื่อแบรนด์ Wingdai ตาม claude.md §10 ไม่ใช่ค่า default ของ template', () => {
    expect(appJson.expo.name).toBe('Wingdai');
    expect(appJson.expo.slug).toBe('wingdai');
  });

  it('bundle id / package ตรงกับที่ลงทะเบียนไว้กับ Google OAuth client', () => {
    expect(appJson.expo.ios.bundleIdentifier).toBe('com.wingdai.app');
    expect(appJson.expo.android.package).toBe('com.wingdai.app');
  });

  it('มี scheme สำหรับ deep link กลับเข้าแอปหลัง OAuth', () => {
    expect(appJson.expo.scheme).toBe('wingdai');
  });

  it('ตามระบบเครื่องได้ทั้งสว่างและมืด ไม่ล็อกสว่างอย่างเดียว', () => {
    // claude.md §10: dark mode ตั้งแต่ commit แรก — ไรเดอร์ทำงานกลางคืน จอสว่างจ้าคือเรื่องความปลอดภัย
    // ถ้าเป็น "light" ธีมมืดใน ThemeProvider จะไม่มีวันถูกใช้บนเครื่องจริง
    expect(appJson.expo.userInterfaceStyle).toBe('automatic');
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าตก**

```bash
cd apps/mobile && npx jest __tests__/app/appConfig.test.ts
```

คาดหวัง: FAIL ทั้ง 4 ข้อ — `expected "Wingdai", received "mobile"` เป็นต้น

- [ ] **Step 3: แก้ app.json**

แทนที่บล็อก `expo` เดิมด้วย (คงคีย์ที่มีอยู่เดิมไว้ทั้งหมด แค่เพิ่ม/แก้ค่าที่ระบุ):

```json
{
  "expo": {
    "name": "Wingdai",
    "slug": "wingdai",
    "scheme": "wingdai",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.wingdai.app"
    },
    "android": {
      "package": "com.wingdai.app",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-localization"
    ]
  }
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd apps/mobile && npx jest __tests__/app/appConfig.test.ts
```

คาดหวัง: PASS ทั้ง 4 ข้อ

- [ ] **Step 5: รันเทสต์ทั้งชุดกันของเดิมพัง**

```bash
cd apps/mobile && npx jest && npx tsc --noEmit
```

คาดหวัง: เขียวทั้งหมด · tsc ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app.json apps/mobile/__tests__/app/appConfig.test.ts
git commit -m "chore(app): ตั้งชื่อ Wingdai + bundle id/scheme + เปิดโหมดมืดตามระบบ"
```

---

## Task 3: `isActiveStatus` + `useActiveOrder`

ตัวตัดสินว่าปุ่มแฮมเบอร์เกอร์จะโผล่ไหม ต้องไม่เป็นลิสต์สถานะที่พิมพ์ซ้ำ — ผูกกับ state machine เพื่อให้เพิ่มสถานะใหม่ในอนาคตแล้วไม่หลุด

**Files:**
- Modify: `apps/mobile/src/data/orderStateMachine.ts`
- Modify: `apps/mobile/src/features/customer/hooks.ts`
- Modify: `apps/mobile/__tests__/data/orderStateMachine.test.ts`
- Modify: `apps/mobile/__tests__/features/customerHooks.test.ts`

**Interfaces:**
- Consumes: `Order`, `OrderStatus` จาก `src/data/types` · `useCustomerOrders()` จาก `src/features/customer/hooks`
- Produces:
  - `isActiveStatus(status: OrderStatus): boolean`
  - `pickActiveOrder(orders: Order[]): Order | undefined`
  - `useActiveOrder(): Order | undefined`

- [ ] **Step 1: เขียนเทสต์ `isActiveStatus` ที่ยังไม่ผ่าน**

เพิ่มท้าย `apps/mobile/__tests__/data/orderStateMachine.test.ts` (เพิ่ม `isActiveStatus` เข้าไปใน import เดิมที่หัวไฟล์):

```ts
describe('isActiveStatus', () => {
  it('สถานะที่ยังเปลี่ยนต่อได้ = ออเดอร์ยังไม่จบ', () => {
    expect(isActiveStatus('created')).toBe(true);
    expect(isActiveStatus('accepted')).toBe(true);
    expect(isActiveStatus('preparing')).toBe(true);
    expect(isActiveStatus('picked_up')).toBe(true);
  });

  it('ปลายทางของ state machine = จบแล้ว', () => {
    expect(isActiveStatus('delivered')).toBe(false);
    expect(isActiveStatus('cancelled')).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd apps/mobile && npx jest __tests__/data/orderStateMachine.test.ts
```

คาดหวัง: FAIL — `isActiveStatus is not a function`

- [ ] **Step 3: เพิ่ม `isActiveStatus`**

เพิ่มท้าย `apps/mobile/src/data/orderStateMachine.ts`:

```ts
/**
 * ออเดอร์ยัง "มีชีวิต" ถ้ายังเปลี่ยนสถานะต่อได้ — delivered/cancelled เป็นปลายทาง
 * ดึงคำตอบจาก ALLOWED โดยตรง ไม่พิมพ์รายชื่อสถานะซ้ำ เพิ่มสถานะใหม่แล้วจะไม่หลุด
 */
export function isActiveStatus(status: OrderStatus): boolean {
  return ALLOWED[status].length > 0;
}
```

- [ ] **Step 4: รันให้ผ่าน**

```bash
cd apps/mobile && npx jest __tests__/data/orderStateMachine.test.ts
```

คาดหวัง: PASS

- [ ] **Step 5: เขียนเทสต์ `pickActiveOrder` ที่ยังไม่ผ่าน**

เพิ่มท้าย `apps/mobile/__tests__/features/customerHooks.test.ts` (เพิ่ม `pickActiveOrder` เข้า import เดิม และเพิ่ม `import type { Order } from '../../src/data/types';`):

```ts
function makeOrder(id: string, status: Order['status'], createdAt: string): Order {
  return {
    id,
    customerId: 'u-1',
    restaurantId: 'r-malee',
    status,
    items: [{ menuItemId: 'm-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 1 }],
    foodTotal: 5000,
    deliveryFee: 1500,
    serviceFee: 500,
    createdAt,
  };
}

describe('pickActiveOrder', () => {
  it('ไม่มีออเดอร์เลย → undefined', () => {
    expect(pickActiveOrder([])).toBeUndefined();
  });

  it('มีแต่ออเดอร์ที่จบแล้ว → undefined (ปุ่มกลาง navbar ต้องไม่โผล่)', () => {
    const orders = [
      makeOrder('o-1', 'delivered', '2026-07-28T01:00:00.000Z'),
      makeOrder('o-2', 'cancelled', '2026-07-28T02:00:00.000Z'),
    ];
    expect(pickActiveOrder(orders)).toBeUndefined();
  });

  it('คืนออเดอร์ที่ยังไม่จบ', () => {
    const orders = [makeOrder('o-1', 'preparing', '2026-07-28T01:00:00.000Z')];
    expect(pickActiveOrder(orders)?.id).toBe('o-1');
  });

  it('มีหลายใบที่ยังไม่จบ → เอาใบล่าสุด', () => {
    const orders = [
      makeOrder('o-1', 'created', '2026-07-28T01:00:00.000Z'),
      makeOrder('o-2', 'picked_up', '2026-07-28T03:00:00.000Z'),
      makeOrder('o-3', 'accepted', '2026-07-28T02:00:00.000Z'),
    ];
    expect(pickActiveOrder(orders)?.id).toBe('o-2');
  });

  it('ไม่สนใจใบที่จบแล้วแม้จะใหม่กว่า', () => {
    const orders = [
      makeOrder('o-1', 'preparing', '2026-07-28T01:00:00.000Z'),
      makeOrder('o-2', 'delivered', '2026-07-28T09:00:00.000Z'),
    ];
    expect(pickActiveOrder(orders)?.id).toBe('o-1');
  });
});
```

- [ ] **Step 6: รันให้เห็นว่าตก**

```bash
cd apps/mobile && npx jest __tests__/features/customerHooks.test.ts
```

คาดหวัง: FAIL — `pickActiveOrder is not a function`

- [ ] **Step 7: เพิ่ม `pickActiveOrder` + `useActiveOrder`**

ใน `apps/mobile/src/features/customer/hooks.ts` เพิ่ม import และฟังก์ชันท้ายไฟล์:

```ts
import { isActiveStatus } from '../../data/orderStateMachine';
import type { Order, Restaurant } from '../../data/types';
```

(รวม `Order` เข้ากับ import `Restaurant` เดิมที่มีอยู่แล้ว อย่าสร้างบรรทัด import ซ้ำ)

```ts
/**
 * ออเดอร์ที่ยังไม่จบใบล่าสุด — ใช้ตัดสินว่าจะโชว์ปุ่มแฮมเบอร์เกอร์กลาง navbar ไหม
 * แยกเป็น pure fn เพื่อทดสอบได้โดยไม่ต้อง mount react-query (แบบเดียวกับ filterApproved)
 */
export function pickActiveOrder(orders: Order[]): Order | undefined {
  const active = orders.filter((o) => isActiveStatus(o.status));
  if (active.length === 0) return undefined;
  return active.reduce((newest, o) => (o.createdAt > newest.createdAt ? o : newest));
}

export function useActiveOrder(): Order | undefined {
  const { data } = useCustomerOrders();
  return pickActiveOrder(data ?? []);
}
```

- [ ] **Step 8: รันเทสต์ทั้งชุด**

```bash
cd apps/mobile && npx jest && npx tsc --noEmit
```

คาดหวัง: เขียวทั้งหมด

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/data/orderStateMachine.ts apps/mobile/src/features/customer/hooks.ts apps/mobile/__tests__/data/orderStateMachine.test.ts apps/mobile/__tests__/features/customerHooks.test.ts
git commit -m "feat(customer): useActiveOrder ผูกนิยาม 'ยังไม่จบ' กับ state machine"
```

---

## Task 4: ไอคอนแฮมเบอร์เกอร์

**Files:**
- Modify: `apps/mobile/src/ui/Icon.tsx`
- Create: `apps/mobile/__tests__/ui/Icon.test.tsx`

**Interfaces:**
- Consumes: —
- Produces: `IconName` เพิ่มค่า `'burger'`

**หมายเหตุ — ไม่ต้องเพิ่มไอคอนกระดิ่งกับชาม:** `inbox` ที่มีอยู่วาดเป็นรูปกระดิ่งอยู่แล้ว และ `menu` วาดเป็นชามอยู่แล้ว ใช้ตัวเดิมทั้งคู่ ไม่ต้องสร้างซ้ำ

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `apps/mobile/__tests__/ui/Icon.test.tsx`:

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { Icon } from '../../src/ui/Icon';

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});

function renderIcon(name: 'burger' | 'inbox' | 'menu') {
  act(() => {
    r = ReactTestRenderer.create(<Icon name={name} color="#111111" />);
  });
  return r!;
}

describe('Icon', () => {
  it('ไอคอนแฮมเบอร์เกอร์วาดเส้นออกมาจริง ไม่ใช่ svg เปล่า', () => {
    expect(renderIcon('burger').root.findAllByType(Path).length).toBeGreaterThan(0);
  });

  it('กระดิ่งกับชามใช้ไอคอนเดิมที่มีอยู่ ไม่ต้องเพิ่มใหม่', () => {
    expect(renderIcon('inbox').root.findAllByType(Path).length).toBeGreaterThan(0);
    expect(renderIcon('menu').root.findAllByType(Path).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd apps/mobile && npx jest __tests__/ui/Icon.test.tsx
```

คาดหวัง: FAIL — TypeScript/runtime error เพราะ `'burger'` ไม่อยู่ใน `IconName`

- [ ] **Step 3: เพิ่มไอคอน**

ใน `apps/mobile/src/ui/Icon.tsx` เพิ่ม `'burger'` เข้า union `IconName` บรรทัดที่มี `'card' | 'qr' | 'cart' | ...`:

```ts
  | 'card' | 'qr' | 'cart' | 'store' | 'help' | 'logout' | 'edit' | 'send' | 'burger'
```

แล้วเพิ่มรูปทรงใน `SHAPES` ต่อจากบรรทัด `send`:

```ts
  burger: {
    p: [
      'M4 10.5a8 8 0 0 1 16 0Z',
      'M3.5 13.8h17',
      'M4.6 16.8h14.8a3 3 0 0 1-3 3H7.6a3 3 0 0 1-3-3Z',
    ],
  },
```

- [ ] **Step 4: รันให้ผ่าน**

```bash
cd apps/mobile && npx jest __tests__/ui/Icon.test.tsx && npx tsc --noEmit
```

คาดหวัง: PASS ทั้ง 2 ข้อ · tsc สะอาด

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui/Icon.tsx apps/mobile/__tests__/ui/Icon.test.tsx
git commit -m "feat(ui): เพิ่มไอคอนแฮมเบอร์เกอร์สำหรับปุ่มออเดอร์กลาง navbar"
```

---

## Task 5: เปลี่ยนชุดแท็บเป็น Home · Menu · History · Me + จอหมวดหมู่

design ไม่มีแท็บกล่องข้อความ แต่มีแท็บ Menu แทน — แจ้งเตือนย้ายไปเข้าจากกระดิ่งบนหัวจอ Home (ทำในคลื่น 1B)

**Files:**
- Create: `apps/mobile/src/features/customer/screens/CategoriesScreen.tsx`
- Modify: `apps/mobile/src/app/navigators/CustomerStack.tsx`
- Modify: `apps/mobile/src/app/navigators/WingdaiTabBar.tsx` (แค่ตาราง `ICONS`)
- Modify: `apps/mobile/src/i18n/locales/th.json`
- Modify: `apps/mobile/src/i18n/locales/en.json`
- Create: `apps/mobile/__tests__/app/Categories.test.tsx`

**Interfaces:**
- Consumes: `useRestaurants()` จาก `src/features/customer/hooks` · `Card`, `IconChip` จาก `src/ui/Surface` · `Icon` จาก `src/ui/Icon`
- Produces:
  - `CustomerTabParamList` = `{ CustomerHome; Categories; Orders; Profile }`
  - `CustomerStackParamList` เพิ่ม `Inbox: undefined`
  - `CategoriesScreen` — props เป็น `NativeStackScreenProps` ที่ใช้แค่ `navigation.navigate`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `apps/mobile/__tests__/app/Categories.test.tsx`:

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { CategoriesScreen } from '../../src/features/customer/screens/CategoriesScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';

beforeAll(async () => {
  await initI18n();
});
let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render(nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <NavigationContainer>
            <CategoriesScreen navigation={nav as never} route={{ key: 'k', name: 'Categories' } as never} />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('CategoriesScreen', () => {
  it('แสดงหมวดครบทุกค่าใน CuisineCategory', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    for (const c of ['rice', 'noodle', 'somtam', 'drink', 'dessert']) {
      expect(findAll(result.root, `category-${c}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('กดหมวดแล้วเห็นเฉพาะร้านในหมวดนั้น', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    act(() => {
      findAll(result.root, 'category-rice')[0].props.onPress();
    });
    await flush();
    // r-malee เป็นร้านข้าวใน seed · r-somtam ไม่ใช่
    expect(findAll(result.root, 'category-restaurant-r-malee').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'category-restaurant-r-somtam').length).toBe(0);
  });

  it('กดร้านในหมวด → navigate ไป RestaurantDetail', async () => {
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => {
      findAll(result.root, 'category-rice')[0].props.onPress();
    });
    await flush();
    act(() => {
      findAll(result.root, 'category-restaurant-r-malee')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RestaurantDetail', { restaurantId: 'r-malee' });
  });

  it('กดปุ่มล้างหมวดแล้วกลับมาเห็นกริดหมวดเหมือนเดิม', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    act(() => {
      findAll(result.root, 'category-rice')[0].props.onPress();
    });
    await flush();
    act(() => {
      findAll(result.root, 'category-clear')[0].props.onPress();
    });
    await flush();
    expect(findAll(result.root, 'category-noodle').length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd apps/mobile && npx jest __tests__/app/Categories.test.tsx
```

คาดหวัง: FAIL — หาโมดูล `CategoriesScreen` ไม่เจอ

- [ ] **Step 3: เพิ่มคีย์ i18n**

ใน `apps/mobile/src/i18n/locales/th.json` แก้บล็อก `customer.tabs` และเพิ่ม `customer.categories` ต่อจากนั้น:

```json
    "tabs": {
      "home": "หน้าแรก",
      "menu": "เมนู",
      "orders": "ประวัติ",
      "profile": "ฉัน"
    },
    "categories": {
      "title": "เมนู",
      "subtitle": "เลือกหมวดที่อยากกิน",
      "count_one": "{{count}} ร้าน",
      "count_other": "{{count}} ร้าน",
      "clear": "ดูทุกหมวด",
      "empty": "ยังไม่มีร้านในหมวดนี้"
    },
```

ใน `apps/mobile/src/i18n/locales/en.json` แก้/เพิ่มให้ตรงกัน:

```json
    "tabs": {
      "home": "Home",
      "menu": "Menu",
      "orders": "History",
      "profile": "Me"
    },
    "categories": {
      "title": "Menu",
      "subtitle": "Pick what you feel like",
      "count_one": "{{count}} kitchen",
      "count_other": "{{count}} kitchens",
      "clear": "All categories",
      "empty": "No kitchens in this category yet"
    },
```

**ลบคีย์ `customer.tabs.inbox` ออกทั้งสองไฟล์** เพราะไม่มีแท็บนี้แล้ว — แต่ **เก็บ `customer.inbox.*` ไว้** เพราะจอยังอยู่ (ย้ายไป stack)

- [ ] **Step 4: สร้างจอหมวดหมู่**

สร้าง `apps/mobile/src/features/customer/screens/CategoriesScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card, IconChip } from '../../../ui/Surface';
import { Icon, IconName } from '../../../ui/Icon';
import { useRestaurants } from '../hooks';
import { formatBaht } from '../../../lib/format';
import { DELIVERY_FEE } from '../../cart/pricing';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { CuisineCategory } from '../../../data/types';

const CATEGORIES: CuisineCategory[] = ['rice', 'noodle', 'somtam', 'drink', 'dessert'];

const CATEGORY_ICON: Record<CuisineCategory, IconName> = {
  rice: 'rice',
  noodle: 'noodle',
  somtam: 'somtam',
  drink: 'drink',
  dessert: 'dessert',
};

// จอนี้อยู่ในแท็บ แต่ navigate ข้ามไป RestaurantDetail ที่อยู่บน stack แม่
// จึงประกาศ props ด้วย ParamList ของ stack แม่ ไม่ใช่ของแท็บ
type Props = NativeStackScreenProps<CustomerStackParamList>;

/** C15 — กริดหมวดอาหาร กดแล้วสลับเป็นรายชื่อร้านในหมวดนั้นในจอเดียวกัน */
export function CategoriesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurants } = useRestaurants();
  const [selected, setSelected] = useState<CuisineCategory | null>(null);

  const all = restaurants ?? [];
  const countOf = (c: CuisineCategory) => all.filter((r) => r.cuisine === c).length;
  const inSelected = selected ? all.filter((r) => r.cuisine === selected) : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      contentContainerStyle={{
        padding: p.space.screen,
        paddingBottom: TAB_BAR_CLEARANCE,
        gap: p.space.lg,
      }}
    >
      <View style={{ gap: p.space.xs }}>
        <Text variant="h1">{t('customer.categories.title')}</Text>
        <Text variant="small" color="muted">
          {selected ? t(`customer.cuisine.${selected}`) : t('customer.categories.subtitle')}
        </Text>
      </View>

      {selected === null ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.md }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              testID={`category-${c}`}
              accessibilityRole="button"
              accessibilityLabel={t(`customer.cuisine.${c}`)}
              onPress={() => setSelected(c)}
              style={({ pressed }) => ({
                width: '47%',
                minHeight: 44,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Card style={{ gap: p.space.sm }}>
                <IconChip name={CATEGORY_ICON[c]} tone="brand" />
                <Text variant="body" bold>
                  {t(`customer.cuisine.${c}`)}
                </Text>
                <Text variant="caption" color="faint">
                  {t('customer.categories.count', { count: countOf(c) })}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: p.space.md }}>
          <Pressable
            testID="category-clear"
            accessibilityRole="button"
            onPress={() => setSelected(null)}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.xs }}>
              <Icon name="chevronLeft" color={tokens.brandLink} size={18} />
              <Text variant="small" bold style={{ color: tokens.brandLink }}>
                {t('customer.categories.clear')}
              </Text>
            </View>
          </Pressable>

          {inSelected.length === 0 ? (
            <Text variant="small" color="muted">
              {t('customer.categories.empty')}
            </Text>
          ) : (
            inSelected.map((r) => (
              <Pressable
                key={r.id}
                testID={`category-restaurant-${r.id}`}
                accessibilityRole="button"
                accessibilityLabel={r.name}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: r.id })}
                style={({ pressed }) => ({ minHeight: 44, transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <Card style={{ gap: p.space.xs }}>
                  <Text variant="body" bold>
                    {r.name}
                  </Text>
                  <Text variant="caption" color="muted">
                    {t(`customer.cuisine.${r.cuisine}`)} · ★ {r.rating.toFixed(1)}
                  </Text>
                  <Text variant="caption" color="faint">
                    {r.prepTimeMinutes} min · {formatBaht(DELIVERY_FEE)}
                  </Text>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}
```

**ก่อนเขียนไฟล์นี้ ให้เปิด `apps/mobile/src/ui/Surface.tsx` อ่าน props จริงของ `Card` และ `IconChip` แล้วปรับให้ตรง** — ถ้า `IconChip` ไม่ได้รับ prop ชื่อ `name`/`tone` ให้ใช้ชื่อ prop ที่มีจริง และถ้า `Card` ไม่รับ `style` ให้ครอบด้วย `View` แทน อย่าเดาชื่อ prop

`navigation.navigate('RestaurantDetail', …)` เรียกข้ามจากแท็บไปหน้าบน stack แม่ได้เพราะ React Navigation ไล่หา route ขึ้นไปตามลำดับชั้นให้เอง — ถ้า TypeScript ฟ้อง ให้ประกาศ props เป็น
`NativeStackScreenProps<CustomerStackParamList>` แทนแล้ว import `CustomerStackParamList`

- [ ] **Step 5: เปลี่ยนชุดแท็บใน CustomerStack**

ใน `apps/mobile/src/app/navigators/CustomerStack.tsx`:

แก้ `CustomerTabParamList`:

```ts
export type CustomerTabParamList = {
  CustomerHome: undefined;
  Categories: undefined;
  Orders: undefined;
  Profile: undefined;
};
```

เพิ่ม `Inbox` เข้า `CustomerStackParamList`:

```ts
export type CustomerStackParamList = {
  Tabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  RestaurantDetail: { restaurantId: string };
  MenuItem: { restaurantId: string; menuItemId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderPlaced: { orderId: string };
  Inbox: undefined;
};
```

แก้ `CustomerTabs` — เอา `Inbox` ออก ใส่ `Categories` แทน เรียงตาม design:

```tsx
      <Tab.Screen name="CustomerHome" component={CustomerHomeScreen} options={{ title: t('customer.tabs.home') }} />
      <Tab.Screen name="Categories" component={CategoriesScreen} options={{ title: t('customer.tabs.menu') }} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} options={{ title: t('customer.tabs.orders') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('customer.tabs.profile') }} />
```

เพิ่ม `Inbox` เป็นจอบน stack ต่อจาก `OrderPlaced`:

```tsx
      <Stack.Screen name="Inbox" component={InboxScreen} />
```

แก้ import — เพิ่ม `CategoriesScreen`, คง `InboxScreen` ไว้:

```ts
import { CategoriesScreen } from '../../features/customer/screens/CategoriesScreen';
```

- [ ] **Step 6: แก้ตาราง ICONS ใน WingdaiTabBar**

ใน `apps/mobile/src/app/navigators/WingdaiTabBar.tsx` แทนที่ตาราง `ICONS`:

```ts
const ICONS: Record<string, IconName> = {
  CustomerHome: 'home',
  Categories: 'menu',
  Orders: 'history',
  Profile: 'user',
};
```

- [ ] **Step 7: รันเทสต์ทั้งชุดแล้วแก้ที่พัง**

```bash
cd apps/mobile && npx jest
```

คาดหวัง: `__tests__/app/Categories.test.tsx` ผ่าน · เทสต์เดิมที่อ้าง `tab-Inbox` หรือคีย์ `customer.tabs.inbox` จะพัง —
ไล่แก้ให้อ้างแท็บใหม่ ห้ามลบเคสทิ้งเฉย ๆ ถ้าเคสนั้นยังตรวจพฤติกรรมที่ยังมีอยู่

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src apps/mobile/__tests__
git commit -m "feat(customer): แท็บใหม่ Home/Menu/History/Me + จอหมวดหมู่ ย้ายกล่องข้อความขึ้น stack"
```

---

## Task 6: ปุ่มลอย 2 ปุ่มบน navbar

หัวใจของคลื่นนี้ — ปุ่มตะกร้ากลางแถบเดิมออก แทนด้วยปุ่มแฮมเบอร์เกอร์กลางที่โผล่เฉพาะตอนมีออเดอร์ที่ยังไม่จบ กับปุ่มตะกร้ากลมมุมขวาล่างที่โผล่เฉพาะตอนมีของ

**Files:**
- Modify: `apps/mobile/src/app/navigators/WingdaiTabBar.tsx`
- Modify: `apps/mobile/src/app/navigators/CustomerStack.tsx` (เพิ่ม route `OrderTracking`)
- Create: `apps/mobile/__tests__/app/WingdaiTabBar.test.tsx`

**Interfaces:**
- Consumes: `useActiveOrder()` จาก Task 3 · `useCartStore` จาก `src/features/cart/cartStore` · `Icon` name `'burger'` จาก Task 4
- Produces: `TAB_BAR_CLEARANCE` (ยังคง export ชื่อเดิม ค่าใหม่ `132`) · testID `tab-order`, `tab-cart`, `tab-cart-count`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `apps/mobile/__tests__/app/WingdaiTabBar.test.tsx`:

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WingdaiTabBar } from '../../src/app/navigators/WingdaiTabBar';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import * as hooks from '../../src/features/customer/hooks';
import type { Order } from '../../src/data/types';

beforeAll(async () => {
  await initI18n();
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
  useCartStore.getState().clear();
  jest.restoreAllMocks();
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}

const ROUTE_NAMES = ['CustomerHome', 'Categories', 'Orders', 'Profile'] as const;

const activeOrder: Order = {
  id: 'o-1',
  customerId: 'u-1',
  restaurantId: 'r-malee',
  status: 'preparing',
  items: [{ menuItemId: 'm-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 1 }],
  foodTotal: 5000,
  deliveryFee: 1500,
  serviceFee: 500,
  createdAt: '2026-07-28T01:00:00.000Z',
};

function render(navigate = jest.fn(), parentNavigate = jest.fn()) {
  const state = {
    index: 0,
    routes: ROUTE_NAMES.map((name, i) => ({ key: `${name}-${i}`, name })),
  };
  const descriptors = Object.fromEntries(
    state.routes.map((route) => [route.key, { options: { title: route.name } }]),
  );
  const navigation = {
    navigate,
    emit: () => ({ defaultPrevented: false }),
    getParent: () => ({ navigate: parentNavigate }),
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <WingdaiTabBar
            state={state as never}
            descriptors={descriptors as never}
            navigation={navigation as never}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('WingdaiTabBar', () => {
  it('เวลาปกติเห็นแค่ 4 แท็บ ไม่มีปุ่มลอยเลย', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(undefined);
    const result = render();
    for (const name of ROUTE_NAMES) {
      expect(findAll(result.root, `tab-${name}`).length).toBe(1);
    }
    expect(findAll(result.root, 'tab-order').length).toBe(0);
    expect(findAll(result.root, 'tab-cart').length).toBe(0);
  });

  it('มีออเดอร์ที่ยังไม่จบ → ปุ่มแฮมเบอร์เกอร์กลางโผล่ กดแล้วไปจอติดตามพร้อม orderId', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(activeOrder);
    const parentNavigate = jest.fn();
    const result = render(jest.fn(), parentNavigate);
    expect(findAll(result.root, 'tab-order').length).toBe(1);
    act(() => {
      findAll(result.root, 'tab-order')[0].props.onPress();
    });
    expect(parentNavigate).toHaveBeenCalledWith('OrderTracking', { orderId: 'o-1' });
  });

  it('ออเดอร์ส่งถึงแล้ว → ปุ่มแฮมเบอร์เกอร์หายไป', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(undefined);
    expect(findAll(render().root, 'tab-order').length).toBe(0);
  });

  it('มีของในตะกร้า → ปุ่มตะกร้ามุมขวาโผล่พร้อมจำนวนชิ้น กดแล้วไปจอตะกร้า', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(undefined);
    act(() => {
      useCartStore.setState({
        restaurantId: 'r-malee',
        lines: [
          {
            lineId: 'm-1',
            menuItemId: 'm-1',
            name: 'ข้าวกะเพรา',
            basePrice: 5000,
            selectedChoices: [],
            unitPrice: 5000,
            quantity: 2,
          },
        ],
      });
    });
    const parentNavigate = jest.fn();
    const result = render(jest.fn(), parentNavigate);
    expect(findAll(result.root, 'tab-cart').length).toBe(1);
    expect(findAll(result.root, 'tab-cart-count')[0].props.children).toBe(2);
    act(() => {
      findAll(result.root, 'tab-cart')[0].props.onPress();
    });
    expect(parentNavigate).toHaveBeenCalledWith('Cart');
  });

  it('มีทั้งออเดอร์และของในตะกร้า → โผล่พร้อมกันทั้งสองปุ่ม', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(activeOrder);
    act(() => {
      useCartStore.setState({
        restaurantId: 'r-malee',
        lines: [
          {
            lineId: 'm-1',
            menuItemId: 'm-1',
            name: 'ข้าวกะเพรา',
            basePrice: 5000,
            selectedChoices: [],
            unitPrice: 5000,
            quantity: 1,
          },
        ],
      });
    });
    const result = render();
    expect(findAll(result.root, 'tab-order').length).toBe(1);
    expect(findAll(result.root, 'tab-cart').length).toBe(1);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd apps/mobile && npx jest __tests__/app/WingdaiTabBar.test.tsx
```

คาดหวัง: FAIL — เคสแรกตกเพราะปุ่ม `tab-cart` โผล่ตลอดในโค้ดปัจจุบัน และ `tab-order` ยังไม่มี

- [ ] **Step 3: เขียน WingdaiTabBar ใหม่**

แทนที่ `apps/mobile/src/app/navigators/WingdaiTabBar.tsx` ทั้งไฟล์:

```tsx
import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Icon, IconName } from '../../ui/Icon';
import { useCartStore } from '../../features/cart/cartStore';
import { useActiveOrder } from '../../features/customer/hooks';

const ICONS: Record<string, IconName> = {
  CustomerHome: 'home',
  Categories: 'menu',
  Orders: 'history',
  Profile: 'user',
};

/**
 * ความสูงที่จอในแท็บต้องเว้นไว้ล่างสุด — เผื่อทั้งแถบ nav และปุ่มตะกร้าที่ลอยอยู่เหนือแถบ
 * ไม่งั้นเนื้อหาบรรทัดสุดท้ายจะโดนบัง
 */
export const TAB_BAR_CLEARANCE = 132;

/**
 * แถบนำทางทรงพิลลอยตาม Wingdai design system
 * 4 แท็บเสมอ · ปุ่มลอย 2 ปุ่มโผล่ตามเงื่อนไขคนละอย่าง:
 *   - แฮมเบอร์เกอร์กลางแถบ → มีออเดอร์ที่ยังไม่จบ → จอติดตาม
 *   - ตะกร้ามุมขวาเหนือแถบ → มีของในตะกร้า → จอตะกร้า
 */
export function WingdaiTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const insets = useSafeAreaInsets();

  const cartCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const activeOrder = useActiveOrder();

  const routes = state.routes;
  const mid = Math.ceil(routes.length / 2);
  const barBottom = Math.max(insets.bottom, p.space.lg);

  const renderTab = (route: (typeof routes)[number], index: number) => {
    const focused = state.index === index;
    const { options } = descriptors[route.key];
    const label = typeof options.title === 'string' ? options.title : route.name;

    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={({ pressed }) => ({
          width: 60,
          alignItems: 'center',
          gap: 3,
          transform: [{ scale: pressed ? 0.86 : 1 }],
        })}
      >
        <View
          style={{
            width: 44,
            height: 34,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            // แผ่นรองไอคอนไม่มีตัวหนังสือทับ จึงใช้สีส้มแบรนด์จริงได้
            backgroundColor: focused ? tokens.brandAccent : 'transparent',
          }}
        >
          <Icon
            name={ICONS[route.name] ?? 'home'}
            color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.62)'}
            size={21}
          />
        </View>
        <Text
          variant="kicker"
          numberOfLines={1}
          style={{
            letterSpacing: 0,
            color: focused ? '#FFFFFF' : 'rgba(255,255,255,0.62)',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      {/* ปุ่มตะกร้า — ลอยมุมขวาเหนือแถบ โผล่เฉพาะตอนมีของ */}
      {cartCount > 0 ? (
        <Pressable
          testID="tab-cart"
          accessibilityRole="button"
          accessibilityLabel={t('customer.cart.title')}
          onPress={() => navigation.getParent()?.navigate('Cart')}
          style={({ pressed }) => [
            {
              position: 'absolute',
              right: p.space.lg,
              bottom: barBottom + 70 + p.space.md,
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: tokens.brandAccent,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.9 : 1 }],
            },
            p.shadow.brand,
          ]}
        >
          <Icon name="cart" color="#FFFFFF" size={24} strokeWidth={2.2} />
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 24,
              height: 24,
              paddingHorizontal: 6,
              borderRadius: 12,
              backgroundColor: tokens.tealSolid,
              borderWidth: 2,
              borderColor: tokens.bgSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text testID="tab-cart-count" variant="kicker" style={{ letterSpacing: 0, color: '#FFFFFF' }}>
              {cartCount}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View
        style={[
          {
            position: 'absolute',
            left: p.space.lg,
            right: p.space.lg,
            bottom: barBottom,
            height: 70,
            backgroundColor: tokens.tealSolid,
            borderRadius: p.radius.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: p.space.sm,
          },
          p.shadow.teal,
        ]}
      >
        {routes.slice(0, mid).map((r, i) => renderTab(r, i))}
        {/* เว้นช่องกลางไว้ให้ปุ่มออเดอร์เฉพาะตอนที่มันโผล่ ไม่งั้นแท็บจะเบี้ยวโดยไม่จำเป็น */}
        {activeOrder ? <View style={{ width: 54 }} /> : null}
        {routes.slice(mid).map((r, i) => renderTab(r, i + mid))}

        {/* ปุ่มออเดอร์ — คร่อมขอบบนแถบ โผล่เฉพาะตอนมีออเดอร์ที่ยังไม่จบ */}
        {activeOrder ? (
          <Pressable
            testID="tab-order"
            accessibilityRole="button"
            accessibilityLabel={t('customer.tracking.title')}
            onPress={() => navigation.getParent()?.navigate('OrderTracking', { orderId: activeOrder.id })}
            style={({ pressed }) => [
              {
                position: 'absolute',
                alignSelf: 'center',
                bottom: 34,
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: tokens.brandAccent,
                borderWidth: 5,
                borderColor: tokens.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.9 : 1 }],
              },
              p.shadow.brand,
            ]}
          >
            <Icon name="burger" color="#FFFFFF" size={26} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
```

- [ ] **Step 4: เพิ่ม route `OrderTracking` ให้ปุ่มมีปลายทาง**

ใน `apps/mobile/src/app/navigators/CustomerStack.tsx` เพิ่มเข้า `CustomerStackParamList`:

```ts
  OrderTracking: { orderId: string };
```

ยังไม่ต้องลงทะเบียน `<Stack.Screen>` ใน Task นี้ — Task 8 เป็นคนสร้างจอ
**ห้ามปล่อยให้ปุ่มกดแล้วไม่มีอะไรเกิดขึ้น** ดังนั้น Task 6 กับ Task 8 ต้อง merge เข้าสาขาพร้อมกัน อย่าปล่อย Task 6 ขึ้น main เดี่ยว ๆ

- [ ] **Step 5: เพิ่มคีย์ i18n ที่ปุ่มใช้เป็น accessibilityLabel**

ตรวจก่อนว่ามี `customer.cart.title` อยู่แล้วหรือยัง:

```bash
cd apps/mobile && grep -n '"cart"' -A3 src/i18n/locales/th.json
```

ถ้ายังไม่มี ให้เพิ่มใน `customer` ของทั้ง `th.json` และ `en.json`
และเพิ่ม `customer.tracking.title` ทั้งสองไฟล์ (Task 8 จะใช้ต่อ):

```json
    "tracking": {
      "title": "ติดตามออเดอร์"
    },
```

```json
    "tracking": {
      "title": "Track order"
    },
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

```bash
cd apps/mobile && npx jest __tests__/app/WingdaiTabBar.test.tsx
```

คาดหวัง: PASS ทั้ง 5 เคส

- [ ] **Step 7: รันทั้งชุด**

```bash
cd apps/mobile && npx jest && npx tsc --noEmit
```

คาดหวัง: เขียวทั้งหมด — จอในแท็บที่ใช้ `TAB_BAR_CLEARANCE` จะเว้นล่างมากขึ้นเอง ไม่ต้องแก้รายจอ

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src apps/mobile/__tests__
git commit -m "feat(customer): ปุ่มลอย 2 ปุ่มบน navbar — ออเดอร์กลาง ตะกร้ามุมขวา ตามเงื่อนไข"
```

---

## Task 7: spike — พิสูจน์ว่า MapLibre เรนเดอร์ได้จริงก่อนสร้างจอ

`maplibre-react-native` มีรายงานว่า iOS ไม่รู้จัก URL schema `pmtiles://` แล้ว throw error (issue #618) ส่วน MapLibre Native รองรับ PMTiles ตั้งแต่ Android 11.8.0 / iOS 6.10.0 — **ยังไม่ยืนยันว่าใช้ได้จริงกับเวอร์ชันที่เราจะติดตั้ง** task นี้จึงมีไว้พิสูจน์ ไม่ใช่สร้างฟีเจอร์

**Files:**
- Modify: `apps/mobile/package.json` (ผ่าน `npx expo install`)
- Modify: `apps/mobile/app.json` (config plugin)
- Create: `docs/design/decisions/2026-07-28-maplibre-pmtiles-spike.md`

**Interfaces:**
- Consumes: `app.json` ที่ตั้ง identity แล้วจาก Task 2
- Produces: บันทึกผลการทดสอบ + แหล่ง tile ที่เลือกใช้ ซึ่ง Task 8 จะอ่านไปใช้

- [ ] **Step 1: ตรวจข้อกำหนดก่อนติดตั้ง**

`@maplibre/maplibre-react-native` v11+ ต้องการ **React Native ≥ 0.80** (เรามี 0.86 ✓),
**Android API ≥ 23** และ **new architecture เปิดอยู่เท่านั้น** — ไม่รองรับ old architecture

```bash
cd apps/mobile && grep -rn "newArchEnabled" app.json android/gradle.properties 2>/dev/null
node -e "console.log(require('./package.json').dependencies['react-native'])"
```

Expo SDK 54 ขึ้นไปเปิด new architecture เป็นค่าเริ่มต้นอยู่แล้ว ถ้าเจอ `newArchEnabled=false`
ที่ไหนให้เปลี่ยนเป็น `true` ก่อน ไม่งั้นแอปจะ build ผ่านแต่แผนที่ crash ตอนรัน

- [ ] **Step 2: ติดตั้ง dependency**

```bash
cd apps/mobile
npx expo install expo-dev-client @maplibre/maplibre-react-native
```

- [ ] **Step 3: อ่านเอกสารก่อนตั้งค่า**

เปิด https://maplibre.org/maplibre-react-native/docs/setup/getting-started/ อ่านส่วน Expo
แล้วเพิ่ม config plugin ตามที่เอกสารระบุลงใน `plugins` ของ `apps/mobile/app.json`
(อย่าเดาชื่อ plugin — ใช้ค่าที่เอกสารเขียนไว้ตรง ๆ)

- [ ] **Step 4: build ลง Android**

```bash
cd apps/mobile && npx expo run:android
```

คาดหวัง: build ผ่าน แอปเปิดขึ้นบนเครื่อง/emulator
ถ้า build ตก ให้บันทึก error เต็ม ๆ ลงไฟล์บันทึกใน Step 5 แล้วหยุด อย่าไล่แก้ config มั่ว

- [ ] **Step 5: ทดสอบแหล่ง tile 2 แบบ ตามลำดับ**

ใส่ `MapView` ชั่วคราวลงใน `apps/mobile/src/features/customer/screens/InboxScreen.tsx`
(จอที่ยังว่างที่สุด ใช้เป็นที่ทดลองแล้วลบทิ้ง) แล้วลองสองแบบ:

**แบบ A — `.pmtiles` ฝังเป็น asset:** ดาวน์โหลด extract ของกรุงเทพจาก https://maps.protomaps.com/builds/
ตัดเฉพาะโซนเล็ก ๆ วางที่ `apps/mobile/assets/zone.pmtiles` แล้วอ้างผ่าน style JSON

**แบบ B — style URL ของ MapTiler free tier:** สมัคร API key ฟรีที่ https://maptiler.com
แล้วใช้ style URL ตรง ๆ

- [ ] **Step 6: บันทึกผล**

สร้าง `docs/design/decisions/2026-07-28-maplibre-pmtiles-spike.md` เขียนตามจริง:

```markdown
# Spike — MapLibre + แหล่ง tile บน React Native

วันที่ 2026-07-28 · เวอร์ชันที่ติดตั้ง: `@maplibre/maplibre-react-native@<เวอร์ชันจริงจาก package.json>`

| แบบ | Android | iOS | หมายเหตุ |
|---|---|---|---|
| A · .pmtiles ฝังเป็น asset | <ผ่าน/ไม่ผ่าน> | <ยังไม่ทดสอบ — ไม่มี Apple Developer account> | <error เต็ม ๆ ถ้าไม่ผ่าน> |
| B · MapTiler free tier style URL | <ผ่าน/ไม่ผ่าน> | <ยังไม่ทดสอบ> | |

## เลือกใช้
<ระบุแบบที่เลือก + เหตุผล>

## ผลต่อ claude.md §10
<ถ้าเลือกแบบ B ต้องบันทึกว่าเป็นทางชั่วคราวช่วงพัฒนา และยังต้องกลับไป self-host .pmtiles
ก่อนเปิดใช้จริง เพราะ §5 ห้าม per-load billing — MapTiler free tier มีโควตาต่อเดือน>
```

- [ ] **Step 7: ลบโค้ดทดลองออกจาก InboxScreen**

```bash
cd /Users/pannatron.r/Desktop/Food_rush_project && git diff --stat apps/mobile/src/features/customer/screens/InboxScreen.tsx
```

คาดหวัง: ไม่มี diff เหลือ — จอกลับไปเหมือนเดิมทุกบรรทัด

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app.json docs/design/decisions/
git commit -m "chore(map): ติดตั้ง MapLibre + dev client และบันทึกผล spike แหล่ง tile"
```

---

## Task 8: จอติดตามออเดอร์ (C6)

**Files:**
- Create: `apps/mobile/src/features/customer/components/TrackingMap.tsx`
- Create: `apps/mobile/src/features/customer/screens/OrderTrackingScreen.tsx`
- Modify: `apps/mobile/src/app/navigators/CustomerStack.tsx`
- Modify: `apps/mobile/src/features/customer/hooks.ts`
- Modify: `apps/mobile/src/i18n/locales/{th,en}.json`
- Create: `apps/mobile/__tests__/app/OrderTracking.test.tsx`

**Interfaces:**
- Consumes: `useActiveOrder()` (Task 3) · `useRestaurant(id)` · `TAB_BAR_CLEARANCE` · ผลจาก spike (Task 7)
- Produces: `useOrder(orderId): UseQueryResult<Order | undefined>` · `OrderTrackingScreen` · testID `tracking-status`, `tracking-food-total`, `tracking-delivery-fee`, `tracking-service-fee`, `tracking-restaurant`, `tracking-map`

- [ ] **Step 1: เพิ่ม `getById` ใน OrderRepo**

ต้องมาก่อนเทสต์ เพราะ `jest.spyOn(repos.orders, 'getById')` จะ throw ทันทีถ้าเมธอดยังไม่มี
ทำให้เทสต์ตกด้วยเหตุผลผิด

```bash
cd apps/mobile && grep -n "getById" src/data/repositories/index.ts src/data/mock/index.ts src/data/http/index.ts
```

ถ้าไม่เจอ ให้เพิ่มใน `src/data/repositories/index.ts` ที่ `interface OrderRepo`:

```ts
  getById(orderId: string): Promise<Order | undefined>;
```

ใน `src/data/mock/index.ts` ที่บล็อก `orders`:

```ts
      async getById(orderId: string) {
        await delay();
        const found = orders.find((o) => o.id === orderId);
        return found ? { ...found } : undefined;
      },
```

ใน `src/data/http/index.ts` เพิ่ม stub แบบเดียวกับเมธอดอื่นในไฟล์นั้น (เปิดอ่านแล้วทำตามรูปแบบที่ใช้อยู่)

- [ ] **Step 2: เพิ่ม `useOrder` hook**

ท้าย `apps/mobile/src/features/customer/hooks.ts`:

```ts
export function useOrder(orderId: string) {
  return useQuery({ queryKey: ['order', orderId], queryFn: () => repos.orders.getById(orderId) });
}
```

- [ ] **Step 3: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `apps/mobile/__tests__/app/OrderTracking.test.tsx`:

```tsx
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { OrderTrackingScreen } from '../../src/features/customer/screens/OrderTrackingScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { repos } from '../../src/data';
import type { Order } from '../../src/data/types';

// แผนที่เป็น native module — ไม่มี bridge ใน react-test-renderer จึง mock ทั้ง component
jest.mock('../../src/features/customer/components/TrackingMap', () => {
  const { View } = require('react-native');
  return { TrackingMap: () => <View testID="tracking-map" /> };
});

beforeAll(async () => {
  await initI18n();
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
  jest.restoreAllMocks();
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

const order: Order = {
  id: 'o-1',
  customerId: 'u-1',
  restaurantId: 'r-malee',
  status: 'preparing',
  items: [{ menuItemId: 'm-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 2 }],
  foodTotal: 10000,
  deliveryFee: 1500,
  serviceFee: 500,
  createdAt: '2026-07-28T01:00:00.000Z',
};

function render() {
  jest.spyOn(repos.orders, 'getById').mockResolvedValue(order);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <NavigationContainer>
            <OrderTrackingScreen
              navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
              route={{ key: 'k', name: 'OrderTracking', params: { orderId: 'o-1' } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('OrderTrackingScreen', () => {
  it('แสดงแผนที่', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-map').length).toBe(1);
  });

  it('แสดงสถานะปัจจุบันของออเดอร์', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-status').length).toBe(1);
  });

  it('แยกยอดเป็น 3 ก้อนตาม claude.md §3 ห้ามรวบเป็นก้อนเดียว', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-food-total').length).toBe(1);
    expect(findAll(result.root, 'tracking-delivery-fee').length).toBe(1);
    expect(findAll(result.root, 'tracking-service-fee').length).toBe(1);
  });

  it('แสดงชื่อร้าน', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-restaurant').length).toBe(1);
  });
});
```

- [ ] **Step 4: รันให้เห็นว่าตก**

```bash
cd apps/mobile && npx jest __tests__/app/OrderTracking.test.tsx
```

คาดหวัง: FAIL — `Cannot find module '../../src/features/customer/screens/OrderTrackingScreen'`

- [ ] **Step 5: เพิ่มคีย์ i18n**

ใน `customer.tracking` ของ `th.json` (ต่อจาก `title` ที่ Task 6 เพิ่มไว้):

```json
    "tracking": {
      "title": "ติดตามออเดอร์",
      "orderNumber": "ออเดอร์ #{{id}}",
      "restaurant": "ร้าน",
      "foodTotal": "ค่าอาหาร",
      "deliveryFee": "ค่าส่ง",
      "serviceFee": "ค่าบริการ",
      "total": "รวมทั้งหมด",
      "status": {
        "created": "รอร้านรับออเดอร์",
        "accepted": "ร้านรับออเดอร์แล้ว",
        "preparing": "กำลังทำอาหาร",
        "picked_up": "ไรเดอร์กำลังไปส่ง",
        "delivered": "ส่งถึงแล้ว",
        "cancelled": "ยกเลิกแล้ว"
      }
    },
```

`en.json`:

```json
    "tracking": {
      "title": "Track order",
      "orderNumber": "Order #{{id}}",
      "restaurant": "Kitchen",
      "foodTotal": "Food",
      "deliveryFee": "Delivery",
      "serviceFee": "Service",
      "total": "Total",
      "status": {
        "created": "Waiting for the kitchen",
        "accepted": "Kitchen accepted",
        "preparing": "Cooking now",
        "picked_up": "Rider on the way",
        "delivered": "Delivered",
        "cancelled": "Cancelled"
      }
    },
```

- [ ] **Step 6: สร้าง TrackingMap**

สร้าง `apps/mobile/src/features/customer/components/TrackingMap.tsx` — ห่อ MapLibre ไว้ที่เดียว
ใช้แหล่ง tile ตามที่ Task 7 สรุปไว้ใน `docs/design/decisions/2026-07-28-maplibre-pmtiles-spike.md`

```tsx
import React from 'react';
import { View } from 'react-native';
import { Map } from '@maplibre/maplibre-react-native';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * แหล่ง tile — ใช้ค่าที่ Task 7 สรุปไว้ใน
 * docs/design/decisions/2026-07-28-maplibre-pmtiles-spike.md หัวข้อ "เลือกใช้"
 *
 * ค่าด้านล่างคือ demotiles ของ MapLibre เอง: ฟรี ไม่ต้องมี key ใช้ได้ทันที
 * แต่เป็นแผนที่โลกความละเอียดต่ำ ไม่มีถนนระดับซอย — ใช้ได้เฉพาะช่วงพัฒนา
 * ต้องเปลี่ยนเป็นแหล่งจริงก่อนเปิดใช้ (ดู claude.md §5 เรื่องห้าม per-load billing)
 */
const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/**
 * แผนที่ของจอติดตาม — ห่อ MapLibre ไว้ที่ไฟล์นี้ไฟล์เดียว
 * จอที่เรียกใช้จึงไม่ผูกกับไลบรารีแผนที่ และ mock ในเทสต์ได้ที่จุดเดียว
 *
 * ห้ามใส่ blur ทับแผนที่ตาม claude.md §10 — จอแผนที่ต้องใช้พื้นทึบ
 */
export function TrackingMap({ height }: { height: number }) {
  const { primitives: p } = useTheme();
  return (
    <View testID="tracking-map" style={{ height, borderRadius: p.radius.xl, overflow: 'hidden' }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE_URL} />
    </View>
  );
}
```

**ก่อนเขียนไฟล์นี้ ให้เปิด https://maplibre.org/maplibre-react-native/docs/setup/expo อ่าน props จริงของเวอร์ชัน
ที่ติดตั้งไปใน Task 7** — เอกสารระบุ component ชื่อ `Map` กับ prop `mapStyle` แต่ชื่อ prop ของ
`style`/`Camera` อาจต่างไปตามเวอร์ชัน อย่าเดา

**ถ้า spike (Task 7) สรุปว่าแผนที่เรนเดอร์ไม่ได้เลยบนแพลตฟอร์มที่ทดสอบ:** หยุดแล้วรายงานผู้ใช้
ก่อนเขียนต่อ ให้เลือกระหว่าง (ก) เลื่อนแผนที่ไปคลื่นถัดไป จอติดตามแสดงแค่ไทม์ไลน์กับยอดเงิน
หรือ (ข) เปลี่ยนแหล่ง tile — **ห้ามปล่อยกล่องเปล่าไว้** เพราะเป็น UI ตาย

- [ ] **Step 7: สร้างจอติดตาม**

สร้าง `apps/mobile/src/features/customer/screens/OrderTrackingScreen.tsx`:

```tsx
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useOrder, useRestaurant } from '../hooks';
import { TrackingMap } from '../components/TrackingMap';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { OrderStatus } from '../../../data/types';

const TIMELINE: OrderStatus[] = ['created', 'accepted', 'preparing', 'picked_up', 'delivered'];

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderTracking'>;

/** C6 — แผนที่ + ไทม์ไลน์สถานะ + การ์ดร้าน + ยอดแยก 3 ก้อน */
export function OrderTrackingScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: order } = useOrder(route.params.orderId);
  const { data: restaurant } = useRestaurant(order?.restaurantId ?? '');

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bgSurface, padding: p.space.screen }}>
        <ScreenHeader title={t('customer.tracking.title')} onBack={() => navigation.goBack()} />
        <Text variant="small" color="muted">
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  const reached = TIMELINE.indexOf(order.status);
  const total = order.foodTotal + order.deliveryFee + order.serviceFee;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      contentContainerStyle={{ padding: p.space.screen, gap: p.space.lg }}
    >
      <ScreenHeader title={t('customer.tracking.title')} onBack={() => navigation.goBack()} />

      <TrackingMap height={260} />

      <Card style={{ gap: p.space.md }}>
        <Text testID="tracking-status" variant="h3">
          {t(`customer.tracking.status.${order.status}`)}
        </Text>
        <Text variant="caption" color="faint">
          {t('customer.tracking.orderNumber', { id: order.id })}
        </Text>

        <View style={{ gap: p.space.sm }}>
          {TIMELINE.map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: i <= reached ? tokens.brandAccent : tokens.tealTint,
                }}
              />
              <Text variant="small" color={i <= reached ? 'primary' : 'faint'}>
                {t(`customer.tracking.status.${s}`)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: p.space.xs }}>
        <Text variant="kicker" color="muted">
          {t('customer.tracking.restaurant')}
        </Text>
        <Text testID="tracking-restaurant" variant="body" bold>
          {restaurant?.name ?? ''}
        </Text>
      </Card>

      <Card style={{ gap: p.space.sm }}>
        {order.items.map((it) => (
          <View key={`${it.menuItemId}-${it.name}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="small">
              {it.quantity}× {it.name}
            </Text>
            <Text variant="small">{formatBaht(it.unitPrice * it.quantity)}</Text>
          </View>
        ))}

        {/* claude.md §3 ข้อ 2 — ค่าอาหาร/ค่าส่ง/ค่าบริการ ต้องแยกบรรทัดเสมอ ห้ามรวบ */}
        <View testID="tracking-food-total" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="small" color="muted">
            {t('customer.tracking.foodTotal')}
          </Text>
          <Text variant="small">{formatBaht(order.foodTotal)}</Text>
        </View>
        <View testID="tracking-delivery-fee" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="small" color="muted">
            {t('customer.tracking.deliveryFee')}
          </Text>
          <Text variant="small">{formatBaht(order.deliveryFee)}</Text>
        </View>
        <View testID="tracking-service-fee" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="small" color="muted">
            {t('customer.tracking.serviceFee')}
          </Text>
          <Text variant="small">{formatBaht(order.serviceFee)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body" bold>
            {t('customer.tracking.total')}
          </Text>
          <Text variant="body" bold>
            {formatBaht(total)}
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}
```

**ก่อนเขียน ให้เปิด `src/ui/ScreenHeader.tsx` และ `src/ui/Surface.tsx` อ่าน props จริง** แล้วปรับชื่อ prop
ให้ตรง (เช่น `onBack` อาจชื่ออื่น) อย่าเดา

- [ ] **Step 8: ลงทะเบียน route**

ใน `apps/mobile/src/app/navigators/CustomerStack.tsx` เพิ่ม import และจอ:

```tsx
import { OrderTrackingScreen } from '../../features/customer/screens/OrderTrackingScreen';
```

```tsx
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
```

- [ ] **Step 9: รันเทสต์ให้ผ่าน**

```bash
cd apps/mobile && npx jest __tests__/app/OrderTracking.test.tsx
```

คาดหวัง: PASS ทั้ง 4 เคส

- [ ] **Step 10: รันทั้งชุด + เปิดแอปจริง**

```bash
cd apps/mobile && npx jest && npx tsc --noEmit
```

คาดหวัง: เขียวทั้งหมด

```bash
cd apps/mobile && npx expo run:android
```

ตรวจด้วยตาบนเครื่องจริง:
1. เปิดแอป → navbar มี 4 แท็บ ไม่มีปุ่มลอย
2. ใส่ของลงตะกร้า → ปุ่มตะกร้ากลมโผล่มุมขวาพร้อมตัวเลข
3. สั่งอาหารจนสำเร็จ → ปุ่มแฮมเบอร์เกอร์โผล่กลางแถบ
4. กดปุ่มแฮมเบอร์เกอร์ → เข้าจอติดตาม เห็นแผนที่ สถานะ ยอดแยก 3 ก้อน
5. สลับเครื่องเป็นโหมดมืด → ทุกจอยังอ่านออก ไม่มีตัวหนังสือจมพื้น

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src apps/mobile/__tests__
git commit -m "feat(customer): จอติดตามออเดอร์ — แผนที่ ไทม์ไลน์สถานะ ยอดแยก 3 ก้อน"
```

---

## หลังจบคลื่น 1A

เหลืออีก 2 แผนของคลื่นที่ 1 ที่ต้องเขียนต่อ:

- **1B** — W1-5 จอ A5 สองบริบท · W1-6 ขัด 16 จอเดิมให้ตรง design + กระดิ่งแจ้งเตือน + จอ C20 · W1-7 C2 ค้นหา + C5 PromptPay · W1-8 C18 เลือกวิธีจ่าย
- **1C** — W1-9 auth: login username/เบอร์ · ลืมรหัสผ่านผ่าน OTP · Google sign-in ด้วย client ID ทั้ง 3 ตัวที่ได้มาแล้ว

**หนี้ที่ต้องจ่ายก่อนปิดคลื่นที่ 1:** แก้ `claude.md` ตามรายการ 7 ข้อใน §9 ของ spec
