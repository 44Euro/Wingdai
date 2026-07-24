# Wingdai — Customer Slice 2 Design (Menu Add-ons + Bottom Tabs)

> ต่อจาก customer slice 1 (branch `feat/customer-slice2`, ฐาน 140 tests). อ้าง spec แม่ `2026-07-21-...` §8.2. อ้างอิง UX จาก Grab/LINE MAN (เฉพาะ add-ons + bottom nav — **ไม่เอาโปรฯ/ส่วนลด/คูปอง** ตาม claude.md §2/§3).

**Goal:** (A) เลือกตัวเลือกเพิ่มเติมของเมนู (add-ons) แบบ Grab/LINE MAN ตอนสั่ง (B) bottom navigation bar 4 แท็บ

**Non-goals (ห้ามทำ slice นี้):** ระบบส่วนลด/คูปอง/โปรโมชั่น (claude.md §2) · chat จริงในกล่องข้อความ (Inbox = placeholder) · แผนที่ติดตาม · รีวิว · ฟอร์มเปิดร้าน · "Note to restaurant"/"Preference if unavailable" (ค่อยเพิ่มทีหลัง — slice นี้โฟกัส option groups เท่านั้น)

---

## A. Menu add-ons (option groups)

**Data model (`src/data/types/index.ts`):**
```ts
export interface OptionChoice { id: string; name: string; priceDelta: number; } // สตางค์ (0 = ฟรี)
export interface OptionGroup {
  id: string; name: string;
  minSelect: number;   // 0 = ไม่บังคับ
  maxSelect: number;   // เช่น 2 (max) ; ถ้า min=max=1 = เลือกได้อันเดียวแบบ radio
  choices: OptionChoice[];
}
export interface MenuItem { /* ...เดิม... */ optionGroups?: OptionGroup[]; }
```

**Seed:** เพิ่ม optionGroups ให้ 1–2 เมนู เช่น `m-malee-1` (ข้าวกะเพรา):
- กลุ่ม "ท็อปปิ้ง" `min0 max2`: ไข่ดาว +1500, กุนเชียง +1500
- กลุ่ม "ระดับเผ็ด" `min1 max1`: เผ็ดน้อย/กลาง/มาก (+0) — บังคับเลือก (radio)

**Cart line ต้องผูกกับ option ที่เลือก** (Grab/LINE MAN: เมนูเดียว option ต่างกัน = คนละบรรทัด):
```ts
type CartLine = {
  lineId: string;              // = menuItemId + '|' + choiceIds เรียง (identity ของบรรทัด)
  menuItemId: string;
  name: string;
  basePrice: number;
  selectedChoices: { groupId: string; choiceId: string; name: string; priceDelta: number }[];
  unitPrice: number;           // basePrice + ผลรวม priceDelta
  quantity: number;
};
```
- `useCartStore.addLine(restaurantId, line)` — ถ้ามี lineId เดิม → เพิ่ม qty; ไม่มี → บรรทัดใหม่
- `removeLine(lineId)` / `setQuantity(lineId, qty)` — เปลี่ยนจาก key `menuItemId` เป็น `lineId`
- **นี่คือ refactor ของ cartStore slice 1** (เดิม key ด้วย menuItemId) → ต้องอัปเดต RestaurantDetail/Cart/Checkout/เทสต์ที่ใช้ให้ตรง

**หน้า customize (`MenuItemScreen` ใหม่):** route `{ restaurantId, menuItemId }`
- รูป/ชื่อ/คำอธิบาย/ราคาฐาน + option groups (min=max=1 → radio; maxSelect>1 → checkbox บังคับ ≤ maxSelect) + stepper จำนวน
- ปุ่ม "เพิ่มลงตะกร้า - ฿xx" (ราคา live = (ฐาน+options)×qty) — **disabled ถ้ากลุ่มบังคับ (min≥1) ยังเลือกไม่ครบ**
- กด → `addLine(...)` → `navigation.goBack()`

**RestaurantDetail:** เมนูที่ **มี** optionGroups → กดปุ่มเพิ่ม = navigate ไป `MenuItem`; เมนูที่ **ไม่มี** → `addLine` ตรงๆ (พฤติกรรมเดิม). แถบตะกร้า/จำนวนนับจาก lineId

**Cart:** แต่ละบรรทัดโชว์ชื่อ + รายการ option ที่เลือก (บรรทัดเล็ก) + unitPrice

**Checkout/Order:** `OrderItem.name` ต่อท้ายด้วย option ที่เลือก (เช่น "ข้าวกะเพรา (ไข่ดาว, เผ็ดมาก)") เพื่อให้ร้านเห็น; unitPrice = ราคารวม option

---

## B. Bottom navigation (4 แท็บ)

**dep ใหม่:** `@react-navigation/bottom-tabs` (ติดผ่าน `npx expo install`); ไอคอนวาดด้วย `react-native-svg` (มีแล้ว) — home / receipt / bell / person, สโตรก 1.5, active = brandSolid, inactive = textMuted

**โครง navigation (restructure `CustomerStack` → root stack ครอบ tabs):**
```
CustomerStack (native-stack, headerShown:false บน Tabs)
├── Tabs (bottom-tabs)                      ← tab bar โผล่
│   ├── หน้าแรก   → CustomerHomeScreen
│   ├── ประวัติ   → OrderHistoryScreen
│   ├── กล่องข้อความ → InboxScreen (placeholder)
│   └── โปรไฟล์   → ProfileScreen
├── RestaurantDetail  ┐
├── MenuItem          │  push เหนือ Tabs → tab bar หายตอน drill-down
├── Cart              │  (มาตรฐาน LINE MAN)
├── Checkout          │
└── OrderPlaced       ┘
```
Home ยัง `navigation.navigate('RestaurantDetail', ...)` ได้เพราะ RestaurantDetail อยู่ใน root stack เดียวกัน (เหนือ tabs)

**จอใหม่:**
- **OrderHistoryScreen** — `repos.orders.listForCustomer(account.id)` (มี method อยู่แล้ว) → รายการออร์เดอร์ (ชื่อร้าน/ยอด/สถานะ/เวลา) เรียงใหม่สุดก่อน; empty state ถ้ายังไม่มี. ต้องเพิ่ม hook `useCustomerOrders()` + `CatalogRepo`/`OrderRepo` ที่มีอยู่แล้ว
- **ProfileScreen** — ชื่อ/username/เบอร์ ของ account + `RoleSwitcher` (คอมโพเนนต์เดิม ถ้ามีหลาย capability) + ปุ่มออกจากระบบ (`logout`)
- **InboxScreen** — empty state "ยังไม่มีข้อความ" (placeholder; ไม่มี chat จริง Phase 1)

**i18n ใหม่:** `customer.tabs.{home,orders,inbox,profile}`, `customer.item.{addToBasket,required,spicy...}`, `customer.orders.{title,empty,status.*}`, `customer.profile.{title,phone,logout}`, `customer.inbox.{title,empty}`

---

## เกณฑ์ยอมรับ
1. `npm test` ผ่านหมด (140 เดิม + ใหม่) · `tsc` สะอาด
2. กดเมนู "ข้าวกะเพรา" → เห็นหน้าเลือก ท็อปปิ้ง/ระดับเผ็ด → เลือกไข่ดาว+เผ็ดมาก → ราคาขึ้นเป็น ฿65 → เพิ่มลงตะกร้า → Cart เห็น option + ราค่าถูก
3. เมนูเดียวกัน option ต่างกัน = คนละบรรทัดในตะกร้า
4. กลุ่ม "ระดับเผ็ด" (บังคับ) ยังไม่เลือก → ปุ่มเพิ่มถูก disable
5. bottom nav 4 แท็บใช้ได้ · เข้าร้าน→ตะกร้า→จ่าย แล้ว tab bar หาย · จ่ายเสร็จ ออร์เดอร์โผล่ในแท็บ "ประวัติ"
6. โปรไฟล์เห็นข้อมูล account + ออกจากระบบได้ · ไม่มีโปรฯ/ส่วนลด/คูปองที่ไหนเลย

## ไม่ทำ (ย้ำ)
โปรโมชั่น/ส่วนลด/คูปอง · chat จริง · Note to restaurant · แผนที่/รีวิว/ฟอร์มเปิดร้าน
