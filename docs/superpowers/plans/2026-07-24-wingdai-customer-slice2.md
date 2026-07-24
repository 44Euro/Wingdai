# Wingdai Customer Slice 2 Plan — Menu Add-ons + Bottom Tabs

> REQUIRED SUB-SKILL: executing-plans (inline). ต่อจาก slice 1 (branch `feat/customer-slice2`, ฐาน 140 tests). **ห้ามใส่ Co-Authored-By ในคอมมิต** (ตามที่ผู้ใช้ตั้งไว้).

**Goal:** (A) เมนู add-ons (option groups) แบบ Grab/LINE MAN, (B) bottom nav 4 แท็บ. ไม่มีโปรฯ/ส่วนลด (claude.md §2).

## Global Constraints
- เงินสตางค์ integer; แสดงผ่าน `formatBaht`; fee แยก line item
- ทุกสตริงผ่าน i18n (th+en พร้อมกัน — `translate.test` เช็ค parity)
- `allowFontScaling={false}`; Text/Button/tokens กลาง; ไม่มี glass; ไม่มี emoji เป็นไอคอน (ไอคอนแท็บวาดด้วย react-native-svg)
- query-based screen tests: ห่อ `QueryClientProvider` + `gcTime:0` (กัน jest ค้าง)
- ก่อน commit: `npx jest` + `npx tsc --noEmit` เขียว; commit conventional **ไม่มี co-author**
- รันจาก `apps/mobile/`

---

## Task 1: Data model + seed (OptionGroup/OptionChoice, MenuItem.optionGroups)
**Files:** `src/data/types/index.ts`, `src/data/mock/seed.ts`, `__tests__/data/seed.test.ts`

- `OptionChoice { id; name; priceDelta }`, `OptionGroup { id; name; minSelect; maxSelect; choices }`, `MenuItem.optionGroups?`
- seed: `m-malee-1` เพิ่ม 2 กลุ่ม — "ท็อปปิ้ง" min0/max2 (ไข่ดาว +1500, กุนเชียง +1500); "ระดับเผ็ด" min1/max1 (น้อย/กลาง/มาก +0)
- test: m-malee-1 มี optionGroups; กลุ่ม required (minSelect≥1) มีจริง; priceDelta เป็น integer ≥0
- commit: `feat(customer): add menu option groups to model + seed`

## Task 2: cartStore refactor → option-aware lines (surgical, slice-1 ยังเขียว)
**Files:** `src/features/cart/cartStore.ts`, `__tests__/features/cartStore.test.ts`, `src/features/customer/screens/CartScreen.tsx`
- `SelectedChoice { groupId; choiceId; name; priceDelta }`; `CartLine` เพิ่ม `lineId, basePrice, selectedChoices`; `unitPrice = basePrice + Σ priceDelta`
- `lineId = choices.length ? '<menuItemId>|<choiceIds เรียง>' : menuItemId` (ไม่มี option → lineId = menuItemId → slice-1 ยังทำงาน)
- `addLine(rid, { menuItem, selectedChoices, quantity=1 })` merge by lineId; `addItem(rid, menuItem)` = wrapper `addLine(...selectedChoices:[])`; `setQuantity(lineId,qty)`/`removeItem(lineId)` match by lineId
- CartScreen: stepper ใช้ `l.lineId` (no-option → `qty-inc-m1` เหมือนเดิม) + โชว์บรรทัด option (`l.selectedChoices` map ชื่อ)
- test: เพิ่มเคส addLine กับ option → unitPrice รวม delta; เมนูเดียว option ต่างกัน = 2 บรรทัด; option เดียวกันเพิ่มซ้ำ = qty+1; addItem เดิมยังทำงาน
- commit: `feat(customer): option-aware cart lines (lineId + selected choices)`

## Task 3: MenuItemScreen (customize) + RestaurantDetail wire
**Files:** `src/features/customer/screens/MenuItemScreen.tsx` (new), `src/app/navigators/CustomerStack.tsx` (route `MenuItem: {restaurantId, menuItemId}`), `src/features/customer/screens/RestaurantDetailScreen.tsx`, `__tests__/app/MenuItem.test.tsx`, update `__tests__/app/RestaurantDetail.test.tsx`
- MenuItemScreen: `useRestaurant`+`useMenu` หา item; render option groups (min=max=1 → radio ผ่าน testID `choice-<id>`; maxSelect>1 → checkbox, กันเกิน max); stepper qty; ราคา live; ปุ่ม `btn-add-to-basket` disabled ถ้ากลุ่ม minSelect≥1 ยังไม่ครบ → กด = `addLine` + `goBack`
- RestaurantDetail: ปุ่ม `add-<id>` — ถ้า item.optionGroups?.length → `navigation.navigate('MenuItem',{restaurantId,menuItemId:item.id})`; ไม่มี → `addLine(...[])` (เดิม)
- update RestaurantDetail.test: ใช้เมนูไม่มี option (m-malee-2) ทดสอบ add ตรง; เมนูมี option (m-malee-1) → navigate('MenuItem',...)
- MenuItem.test: required group ยังไม่เลือก → ปุ่ม disabled; เลือกครบ+ไข่ดาว → ราคา +15, กด → line เข้า cart พร้อม selectedChoices
- commit: `feat(customer): menu item customize screen with option groups`

## Task 4: Cart + Checkout แสดง option + ชื่อ order รวม option
**Files:** `CartScreen.tsx` (โชว์ option แล้วจาก Task 2 — ยืนยัน), `CheckoutScreen.tsx`, `__tests__/app/Checkout.test.tsx`
- Checkout: สร้าง OrderItem `name` = ชื่อเมนู + " (option1, option2)" ถ้ามี; `unitPrice` = line.unitPrice
- test: checkout line ที่มี option → order.items[0].name มีวงเล็บ option; unitPrice รวม delta
- commit: `feat(customer): carry selected options into order items`

## Task 5: Bottom tabs restructure + icons + RootNavigator
**Files:** install `@react-navigation/bottom-tabs`; `src/ui/TabIcon.tsx` (new, svg home/receipt/bell/person), `src/app/navigators/CustomerStack.tsx` (root stack → Tabs + flow screens), placeholder `OrderHistoryScreen`/`InboxScreen`/`ProfileScreen` (new, minimal), `__tests__/app/RootNavigator.test.tsx`, i18n `customer.tabs.*`
- `npx expo install @react-navigation/bottom-tabs`
- โครง: `CustomerStack` (native-stack) → `Tabs`(bottom-tabs: Home/Orders/Inbox/Profile) + RestaurantDetail/MenuItem/Cart/Checkout/OrderPlaced (push เหนือ Tabs). Home tab = CustomerHomeScreen
- สร้าง 3 จอ minimal (testID `screen-order-history`/`screen-inbox`/`screen-profile`) พอให้ compile
- RootNavigator test: customer → ยังเจอ `screen-customer-home` (อยู่ในแท็บ Home ที่เป็น initial)
- commit: `feat(customer): 4-tab bottom navigation shell`

## Task 6: OrderHistoryScreen (จริง) + useCustomerOrders
**Files:** `src/features/customer/hooks.ts` (+`useCustomerOrders`), `OrderHistoryScreen.tsx`, `__tests__/app/OrderHistory.test.tsx`, i18n `customer.orders.*`
- `useCustomerOrders()` = `useQuery(['orders',accountId], () => repos.orders.listForCustomer(accountId))` (account จาก authStore)
- จอ: รายการออร์เดอร์ (ชื่อร้าน/ยอดรวม/สถานะ/เวลา) เรียงใหม่สุดก่อน; empty state; card testID `order-<id>`
- test: seed order ผ่าน repo → mount → เห็น order card; ว่าง → empty state
- commit: `feat(customer): order history screen`

## Task 7: ProfileScreen + InboxScreen (จริง)
**Files:** `ProfileScreen.tsx`, `InboxScreen.tsx`, `__tests__/app/Profile.test.tsx`, i18n `customer.profile.*`/`customer.inbox.*`
- Profile: ชื่อ/username/เบอร์ จาก authStore.account + `RoleSwitcher` (ถ้ามีหลาย cap) + ปุ่ม `btn-logout` → `logout()`
- Inbox: empty state "ยังไม่มีข้อความ"
- test: Profile เห็นชื่อ account + กด logout → authStore.account = null
- commit: `feat(customer): profile + inbox tab screens`

## เกณฑ์ผ่าน
`npx jest` (140 + ใหม่) เขียว · `tsc` สะอาด · เดิน flow: เลือกเมนูมี option → ปรับราคา → ตะกร้าแยกบรรทัด → จ่าย → เห็นใน "ประวัติ"; bottom nav 4 แท็บ; ไม่มีโปรฯ/ส่วนลด
