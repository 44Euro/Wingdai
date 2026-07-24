# Wingdai — Mobile App

React Native + Expo (SDK 57), TypeScript. แอปเดียวหลาย role ตาม capability (ลูกค้า / ร้าน / ไรเดอร์ / แอดมิน) — ดู `CLAUDE.md` ที่ราก repo สำหรับบริบทสินค้า/สถาปัตยกรรม

## รันแอป

```bash
cd apps/mobile
npm install
npm run web      # เปิดบนเบราว์เซอร์ (react-native-web)
npm run ios      # iOS simulator
npm run android  # Android emulator
npm test         # jest ทั้งหมด
```

## บัญชีทดสอบ (mock data)

> ตอนนี้ใช้ **mock data** ทั้งหมด (ยังไม่ต่อ backend จริง) — รหัสผ่านของ **ทุกบัญชี** คือ `1234`
> ช่อง "เข้าสู่ระบบ" รับได้ทั้ง **username หรือ email** เป็น identifier (email เป็น login alias เสริม ไม่ผ่าน OTP)

| Username | Email (ใช้ล็อกอินแทน username ได้) | รหัสผ่าน | ประเภทบัญชี | เข้าแอปแล้วเจอ |
|---|---|---|---|---|
| `somchai` | `somchai@wingdai.test` | `1234` | user | ลูกค้าทั่วไป → หน้าสั่งอาหาร (CustomerStack) |
| `malee` | `malee@wingdai.test` | `1234` | user + เจ้าของร้าน | เริ่มที่โหมดร้าน (MerchantStack) เพราะเป็นเจ้าของร้าน "ครัวมาลี" ที่อนุมัติแล้ว · สลับเป็นโหมดลูกค้าได้ |
| `rider_ann` | `rider_ann@wingdai.test` | `1234` | rider (อนุมัติแล้ว) | โหมดไรเดอร์ (RiderStack) · สลับเป็นโหมดลูกค้าได้ |
| `rider_new` | `rider_new@wingdai.test` | `1234` | rider (รออนุมัติ) | เห็นแค่หน้า "รออนุมัติ" เข้า stack อื่นไม่ได้ |
| `admin_root` | `admin_root@wingdai.test` | `1234` | admin | โหมดผู้ดูแล (AdminStack) — สร้างจาก seed เท่านั้น ไม่มีทางสมัคร |

> Merchant/Rider/Admin stack บางส่วนยังเป็นหน้า placeholder — กำลังไล่ทำตามลำดับใน `docs/superpowers/specs/`

## ร้าน/เมนูใน seed (ใช้ทดสอบการสั่งอาหาร)

| ร้าน | หมวด | สถานะ | เจ้าของ | หมายเหตุ |
|---|---|---|---|---|
| ครัวมาลี | ข้าว | เปิด | `malee` | มี 4 เมนูพร้อมสั่ง (1 เมนู "หมด") |
| ส้มตำแซ่บนัว | ส้มตำ | เปิด | (ร้านอื่น) | สั่งได้ปกติ |
| ก๋วยเตี๋ยวเรือ | ก๋วยเตี๋ยว | **ปิด** | (ร้านอื่น) | เข้าดูเมนูได้ แต่กดเพิ่มลงตะกร้าไม่ได้ |
| ร้านรออนุมัติ | ข้าว | ปิด | `somchai` | **ไม่อนุมัติ** → ไม่โผล่ในหน้าลูกค้า |

**ทดสอบกฎกันโกง:** ล็อกอินเป็น `malee` (เจ้าของครัวมาลี) แล้วลองสั่งจาก "ครัวมาลี" — ระบบจะบล็อกที่ตอนกดยืนยันชำระเงิน (สั่งร้านตัวเองไม่ได้)
