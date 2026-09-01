# core-api

Wingdai backend — auth, catalog, order, payment, ledger, notification.
NestJS + Drizzle บน Supabase Postgres ดูเหตุผลที่เลือกสแตกนี้ได้ที่ `docs/product-spec.md` §5

auth · catalog · order · dispatch · ledger · refund · payout · support · review ใช้งานได้ครบ
แอปมือถือคุยกับ API ตัวนี้จริง แล้วถอยไปใช้ข้อมูลจำลองเองเมื่อเรียกไม่ติด

## ตั้งเครื่องครั้งแรก

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) — เลือก region **Southeast Asia (Singapore)**
   ให้ตรงกับที่ `docs/product-spec.md` §5 วางไว้ (หน่วงจากกรุงเทพ ~30ms)
2. Project Settings → Database → Connection string → เอาแบบ **direct connection** (พอร์ต 5432)
   ตัว pooler (พอร์ต 6543) ใช้รัน migration ไม่ได้ เพราะไม่มี session state
3. ```bash
   cp .env.example .env    # ใส่ DATABASE_URL จริง + สร้าง JWT_SECRET ด้วย openssl rand -base64 48
   npm install
   npm run db:setup        # PostGIS → migration → trigger/constraint
   npm run db:verify       # ยิงของจริงพิสูจน์ว่าด่านทั้งหมดทำงาน
   npm run db:seed         # ข้อมูลตั้งต้นสำหรับพัฒนา
   ```

> `db:setup` ทำแทน `drizzle-kit migrate` เพราะ CLI ตัวนั้นกลืน error แล้วจบด้วย exit 0
> ทั้งที่ไม่ได้สร้างตารางอะไรเลย เสียเวลาไล่หาสาเหตุนานมาก

## ล้างฐานสาธิตกลับเป็นชุดตั้งต้น

ฐานสาธิตเปิดให้ใครก็ล็อกอินเป็นแอดมินได้ ของจึงเพี้ยนไปเรื่อย ๆ ชุดคำสั่งนี้ล้างแล้วสร้างใหม่ทั้งหมด

```bash
npm run db:reset -- --yes   # truncate ทุกตารางใน schema public (ต้องพิมพ์ --yes เอง)
npm run db:setup            # migration ที่เพิ่มมาใหม่
npm run db:seed             # โซน บัญชี ร้าน เมนู ที่อยู่
DEMO_API_URL=https://wingdai-api.vercel.app/api npm run db:demo-orders
```

`db:demo-orders` ยิง HTTP จริงใส่ API ที่รันอยู่ ไม่ได้ insert ลงตารางตรง ๆ เพราะเส้นทางเดียวกันนี้
เป็นตัวลง ledger เปลี่ยนสถานะ และตรวจกติกาทั้งหมด (§6.2) ได้ออร์เดอร์สี่ใบครบวงจร
รอร้านรับ · กำลังทำ · กำลังส่ง · ส่งถึงแล้วพร้อมรีวิวและทิป ทุกใบลงร้านของบัญชีสาธิตฝั่งร้าน

GitHub Actions (`.github/workflows/demo-maintenance.yml`) รันชุดนี้ให้เองตี 2 ตามเวลาไทย
secret `DATABASE_URL` ที่นั่นต้องเป็นสาย **session pooler** (`pooler.supabase.com` พอร์ต 5432)
ไม่ใช่สายตรง `db.<ref>.supabase.co` เพราะโฮสต์สายตรงมีแต่ระเบียน AAAA แล้ว runner ต่อ IPv6 ไม่ได้

## รันเซิร์ฟเวอร์

```bash
npm run dev            # โหมดพัฒนา รีโหลดเองเมื่อแก้ไฟล์
npm start              # ต้อง npm run build ก่อน
npm run api:smoke      # ยิง HTTP จริงทั้งเส้นทางสมัคร/ล็อกอิน (ต้องมีเซิร์ฟเวอร์รันอยู่)
```

บัญชีจาก `db:seed` ทุกตัวใช้รหัสผ่าน `wingdai1234` — `somchai` (ลูกค้า) · `malee` (ลูกค้า+เจ้าของร้าน) ·
`rider_ann` (ไรเดอร์อนุมัติแล้ว) · `rider_new` (รออนุมัติ) · `admin_root`

## โมดูล auth

ลำดับการสมัครตรงกับที่แอปทำ (`docs/product-spec.md` §4.2) — ยืนยันเบอร์เกิด**ก่อน**บัญชีจะมีอยู่จริง
ตั๋วยืนยันจึงผูกกับเบอร์ ไม่ใช่ผูกกับบัญชี

```
POST /api/auth/otp/request  { phone }                 → { expiresAt, devCode? }
POST /api/auth/otp/verify   { phone, code }           → { verificationToken }   อายุ 15 นาที
POST /api/auth/register     { …, verificationToken }  → { token, account }
POST /api/auth/login        { identifier, password }  → { token, account }
GET  /api/auth/me           Bearer token              → account
```

- `identifier` คือ **username หรือเบอร์โทร** — อีเมลใช้ล็อกอินไม่ได้ (§4.2)
- `accountType` รับแค่ `user` กับ `rider` — สร้าง admin ผ่าน API สาธารณะไม่ได้ (§4.1)
- `devCode` คืนมาเฉพาะตอนไม่ใช่ production เพราะยังไม่ได้เลือกผู้ให้บริการ SMS (§11 ข้อ 3)
  เปลี่ยนคลาสเดียวใน `src/auth/sms.ts` เมื่อเลือกได้แล้ว

รหัสผ่านเก็บด้วย **argon2id** ไม่ใช่ bcrypt เพราะ bcrypt ตัดที่ 72 ไบต์
ซึ่งภาษาไทยกินตัวละ 3 ไบต์ — รหัสผ่านไทยยาว ๆ จะกลายเป็นรหัสเดียวกันหมด

## กติกาที่ฐานข้อมูลบังคับให้เอง

ทั้งหมดอยู่ใน `drizzle/guards.sql` เป็นด่านสุดท้าย ไม่ใช่ด่านเดียว —
ชั้นแอปต้องตรวจก่อนอยู่แล้ว แต่เรื่องเงินพลาดแล้วแพงเกินกว่าจะฝากไว้กับโค้ดอย่างเดียว

| กติกา | อ้างอิง |
|---|---|
| `ledger_entries` UPDATE/DELETE ไม่ได้เลย แก้ด้วยรายการกลับทางเท่านั้น | §6.2 |
| ทุก `entry_group_id` ต้องเดบิตรวม = เครดิตรวม ตรวจตอน COMMIT | §6.2 |
| สั่งอาหารจากร้านตัวเองไม่ได้ · ไรเดอร์รับงานร้านตัวเองไม่ได้ | §4.3 |
| `commission_satang` ต้องเท่ากับ 15% ของค่าอาหารเป๊ะ | §6.1 |
| เจ้าของร้านต้องเป็นบัญชี `user` เท่านั้น (merchant ไม่ใช่ประเภทบัญชี) | §4.3 · §7 |
| โปรไฟล์ไรเดอร์มีได้เฉพาะบัญชี `rider` | §7 |
| เงินสดที่ไรเดอร์ถืออยู่ติดลบไม่ได้ | §6.2 |

`db:verify` ตรวจว่าแต่ละข้อถูกตีกลับ **ด้วยเหตุผลที่ถูกต้อง** ไม่ใช่แค่ "มี error สักอย่าง" —
เคยเจอมาแล้วว่าข้อมูลทดสอบไปชนกับ unique index แล้วทุกข้อขึ้น ✓ ทั้งที่ trigger ไม่เคยถูกเรียก

## เงินเป็นสตางค์เสมอ

ทุกคอลัมน์ที่เป็นเงินประกาศผ่าน `satang()` ใน `src/db/schema/money.ts` ไม่ใช่ `integer()` ตรง ๆ
เพื่อให้ `grep -rn "satang("` เจอทุกช่องที่เป็นเงินได้ในคำสั่งเดียว
ห้ามมี `numeric` / `decimal` / ทศนิยม ในเส้นทางเงินเด็ดขาด (§5 กติกาข้อ 1)

```bash
npm test        # เทสต์บัญชี + รหัสผ่าน + กติกา OTP
npm run typecheck
```

## catalog · order · ที่อยู่

```
GET  /api/catalog/restaurants          ไม่ต้องล็อกอิน · ?q= ค้นทั้งชื่อร้านและชื่อเมนู
GET  /api/catalog/restaurants/:id
GET  /api/catalog/restaurants/:id/menu
POST /api/orders                       Bearer · { restaurantId, items, paymentMethod }
GET  /api/orders                       ออร์เดอร์ของตัวเอง
GET  /api/orders/:id                   ลูกค้า/ไรเดอร์ที่รับงาน/เจ้าของร้าน เท่านั้น
PATCH /api/orders/:id/status           ถึง delivered = เขียน ledger ในทรานแซกชันเดียวกัน
POST /api/orders/:id/pay-promptpay     เงินสดไม่พอ → จ่ายพร้อมเพย์แทน (§6.5)
GET/POST /api/addresses
```

**เซิร์ฟเวอร์คิดเงินเองทั้งหมด** — `items` ส่งมาแค่ `{ menuItemId, quantity, choiceIds }`
ไม่มีช่องราคาให้ส่ง ถ้ารับราคาจากแอป คนที่แก้แอปจะสั่งของแพงในราคาถูกได้
และคอมมิชชัน 15% (§6.1) จะคิดจากยอดปลอมนั้น — ร้านเสียเงินจริง

`rating` กับ `distanceKm` เป็น `null` เมื่อไม่รู้จริง **ไม่ใส่ค่าปลอมแทน**
ยังไม่มีระบบรีวิว (คลื่นที่ 3) และระยะทางรู้ได้ต่อเมื่อล็อกอินแล้วมีที่อยู่

## Google sign-in

```
POST /api/auth/google           { idToken } → เคยผูกแล้วได้ token · ยังไม่เคยได้ googleToken
POST /api/auth/google/register  { googleToken, username, fullName, phone, accountType,
                                  verificationToken }
```

- ตรวจ `id_token` ที่เซิร์ฟเวอร์เท่านั้น (ยอมรับ `aud` ทั้งสาม client: web/iOS/Android)
- ผูกบัญชีด้วย Google `sub` **ไม่ใช่อีเมล** — อีเมลฝั่งเราไม่เคยยืนยัน จับคู่อัตโนมัติ = ยึดบัญชีกันได้
- Google **ไม่ทดแทน OTP** คนใหม่ยังต้องยืนยันเบอร์
- บัญชี Google ล้วนมี `password_hash` เป็น null และ `login` ตอบเหมือนกรณีหาไม่เจอเป๊ะ

## ที่ยังไม่ได้ทำ

- dispatch (§6.3) · คืนเงิน (§6.4) · payout (§6.2) — ยังไม่มี
- เพิ่ม/แก้เมนูฝั่งร้าน — ยังไม่มี endpoint (คลื่นที่ 3)
- `PAYMENT_FEE_BP` ยังเป็น 0 ทุกช่องทาง เพราะยังไม่ได้เลือกเกตเวย์ (§11 ข้อ 3)
  **ต้องกลับมาแก้ตอนเลือกได้** ไม่งั้นรายงานกำไรจะสูงเกินจริง
- refresh token — ตอนนี้ตั๋วเซสชันอายุ 30 วันและเพิกถอนกลางคันไม่ได้
- ตาราง `payouts` รอบจ่ายเงินรายสัปดาห์ (§6.2) — Phase 2
- ตารางตำแหน่งไรเดอร์ + dispatch (§6.3)
- ขอบเขตโซนตอนนี้เก็บเป็น GeoJSON ใน `zones.boundary_geojson` แล้วแปลงตอน query
  ด้วย `ST_GeomFromGeoJSON` — พอโซนเยอะขึ้นค่อยทำคอลัมน์ polygon จริงพร้อม GiST index
