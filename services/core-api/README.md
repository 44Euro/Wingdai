# core-api

Wingdai backend — auth, catalog, order, payment, ledger, notification.
TypeScript + Drizzle on Supabase Postgres. See `CLAUDE.md` §5 for why this stack.

Right now this package contains the **database schema and the ledger maths only**.
The NestJS HTTP layer is not built yet — the mobile app still runs on its mock repo.

## ต่อกับ Supabase

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) — เลือก region **Southeast Asia (Singapore)**
   ให้ตรงกับที่ `CLAUDE.md` §5 วางไว้ (หน่วงจากกรุงเทพ ~30ms)
2. Project Settings → Database → Connection string → เอาแบบ **direct connection** (พอร์ต 5432)
   ตัว pooler (พอร์ต 6543) ใช้รัน migration ไม่ได้ เพราะไม่มี session state
3. ```bash
   cp .env.example .env    # แล้วใส่ค่าจริง
   npm install
   npm run db:migrate
   psql "$DATABASE_URL" -f drizzle/0001_guards.sql
   ```

> `0001_guards.sql` ต้องรันมือแยก เพราะเป็น trigger กับ constraint ที่ drizzle-kit
> generate ให้ไม่ได้ — และมันคือด่านที่กัน ledger ไม่ให้เพี้ยน อย่าข้าม

## กติกาที่ฐานข้อมูลบังคับให้เอง

ทั้งหมดอยู่ใน `drizzle/0001_guards.sql` เป็นด่านสุดท้าย ไม่ใช่ด่านเดียว —
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

## เงินเป็นสตางค์เสมอ

ทุกคอลัมน์ที่เป็นเงินประกาศผ่าน `satang()` ใน `src/db/schema/money.ts` ไม่ใช่ `integer()` ตรง ๆ
เพื่อให้ `grep -rn "satang("` เจอทุกช่องที่เป็นเงินได้ในคำสั่งเดียว
ห้ามมี `numeric` / `decimal` / ทศนิยม ในเส้นทางเงินเด็ดขาด (§5 กติกาข้อ 1)

```bash
npm test        # เทสต์บัญชี — พิสูจน์ว่าเดบิต = เครดิต แบบกวาดหลายพันกรณี
npm run typecheck
```

## ที่ยังไม่ได้ทำ

- ชั้น HTTP (NestJS modules) — ยังไม่มี
- ตาราง `payouts` รอบจ่ายเงินรายสัปดาห์ (§6.2) — Phase 2
- ตารางตำแหน่งไรเดอร์ + dispatch (§6.3)
- ขอบเขตโซนตอนนี้เก็บเป็น GeoJSON ใน `zones.boundary_geojson` แล้วแปลงตอน query
  ด้วย `ST_GeomFromGeoJSON` — พอโซนเยอะขึ้นค่อยทำคอลัมน์ polygon จริงพร้อม GiST index
