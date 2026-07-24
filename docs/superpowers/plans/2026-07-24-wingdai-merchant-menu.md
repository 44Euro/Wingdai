# Wingdai Merchant Menu Management Plan

> executing-plans (inline). branch `feat/merchant-menu` (จาก `feat/customer-slice2`). **ไม่ใส่ Co-Authored-By**. ขอบเขต: เจ้าของร้านเพิ่มเมนู + สร้างกลุ่มตัวเลือกไม่จำกัด (ยังไม่ทำคิวออร์เดอร์ร้าน ⭐). ไม่มีโปรฯ/ส่วนลด (§2).

## Global Constraints
- เงินสตางค์ integer (ราคากรอกเป็นบาท → แปลงเป็นสตางค์); i18n th+en พร้อมกัน; `allowFontScaling={false}`; Text/Button/tokens; ไม่มี glass
- query test ห่อ QueryClientProvider + gcTime:0
- ก่อน commit: `npx jest` (แยกจาก pipe เพื่อไม่บัง exit code) + `npx tsc --noEmit` เขียว; commit conventional ไม่มี co-author
- รันจาก `apps/mobile/`

## Task M1: CatalogRepo.createMenuItem
**Files:** `src/data/repositories/index.ts` (interface + `NewMenuItemInput`), `src/data/mock/index.ts` (impl), `src/data/http/index.ts` (stub), `__tests__/data/mockRepos.test.ts`
- `NewMenuItemInput = Omit<MenuItem,'id'>` (restaurantId, name, description?, price, category, isAvailable, optionGroups?)
- `CatalogRepo.createMenuItem(input): Promise<MenuItem>` → mock: id `mi-${++seq}`, push เข้า menuItems, คืน copy
- test: createMenuItem แล้ว getMenu(restaurantId) เห็นเมนูใหม่ (ถ้า isAvailable) + optionGroups ติดมาครบ
- commit: `feat(merchant): CatalogRepo.createMenuItem`

## Task M2: MerchantStack + MerchantMenuScreen + wire RootNavigator
**Files:** `src/app/navigators/MerchantStack.tsx` (new), `src/features/merchant/screens/MerchantMenuScreen.tsx` (new), `src/features/merchant/hooks.ts` (new: `useOwnerRestaurantId`), `src/app/RootNavigator.tsx`, `src/i18n/*` (`merchant.*`), `__tests__/app/RootNavigator.test.tsx`, `__tests__/app/MerchantMenu.test.tsx`
- `MerchantStackParamList = { MerchantMenu: undefined; AddMenuItem: { restaurantId: string } }`
- `useOwnerRestaurantId()` = จาก authStore หา `restaurants.find(r => r.ownerUserId === account.id && r.isApproved)?.id`
- MerchantMenuScreen (testID `screen-merchant-menu`): หัวข้อ + `RoleSwitcher` (กลับโหมดลูกค้า) + ปุ่ม `btn-add-menu` → navigate('AddMenuItem',{restaurantId}) + ลิสต์เมนูปัจจุบัน (useMenu) card `menu-row-<id>` + ปุ่ม logout
- RootNavigator: merchant → `<MerchantStack/>` แทน PlaceholderStack; test เดิม `stack-merchant` → `screen-merchant-menu`
- MerchantMenu.test: malee (merchant) เห็น screen-merchant-menu + เมนู r-malee; กด btn-add-menu → navigate AddMenuItem
- commit: `feat(merchant): menu list screen + MerchantStack wired into RootNavigator`

## Task M3: AddMenuItemScreen (ฟอร์ม + ตัวสร้างกลุ่มตัวเลือกไม่จำกัด)
**Files:** `src/features/merchant/screens/AddMenuItemScreen.tsx` (new), `MerchantStack.tsx` (route), `__tests__/app/AddMenuItem.test.tsx`, i18n
- ฟอร์ม: `input-name`, `input-desc`, `input-price` (บาท), หมวด (chips `cat-<c>`), `toggle-available`
- ตัวสร้างกลุ่ม (state `DraftGroup[]`): ปุ่ม `btn-add-group` → เพิ่มกลุ่ม; ต่อกลุ่ม `input-group-name-<gi>`, min/max stepper, ปุ่ม `btn-add-choice-<gi>` → เพิ่มตัวเลือก; ต่อตัวเลือก `input-choice-name-<gi>-<ci>` + `input-choice-price-<gi>-<ci>`; ปุ่มลบกลุ่ม/ตัวเลือก. **ไม่จำกัดจำนวน**
- ปุ่ม `btn-save` disabled ถ้า name ว่าง/price<=0 → build NewMenuItemInput (แปลงบาท→สตางค์, gen id กลุ่ม/ตัวเลือก, ตัดกลุ่มที่ไม่มีชื่อ/ตัวเลือก) → `useCreateMenuItem().mutate` → invalidate `['menu',restaurantId]` → goBack
- hook `useCreateMenuItem()` ใน merchant/hooks.ts (useMutation + queryClient.invalidateQueries)
- test: กรอกชื่อ+ราคา → กด add-group → กด add-choice → กรอกชื่อ/ราคาตัวเลือก → save → createMenuItem ถูกเรียกด้วย optionGroups ที่มี 1 กลุ่ม 1 ตัวเลือก, price เป็นสตางค์
- commit: `feat(merchant): add-menu-item form with unlimited option builder`

## เกณฑ์ผ่าน
`npx jest` เขียว · `tsc` สะอาด · malee โหมดร้าน → เพิ่มเมนูพร้อมกลุ่มตัวเลือกหลายกลุ่ม → เมนูโผล่ในลิสต์ · สลับกลับโหมดลูกค้าเห็นเมนูใหม่
