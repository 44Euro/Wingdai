# Wingdai Auth Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox tracking. ต่อยอดจาก foundation (branch `feat/foundation`, 95 tests ผ่าน).

**Goal:** ทำ Auth Stack ให้ครบ — สมัครสมาชิก (Register → OTP → เลือก user/rider), ลืมรหัสผ่าน, และล็อกอินด้วย username หรือ email

**Architecture:** เพิ่ม React Navigation native-stack สำหรับ auth flow (Login/Register/OtpVerify/ChooseAccountType/ForgotPassword). RootNavigator: ยังไม่ล็อกอิน → AuthNavigator, ล็อกอินแล้ว → capability switch เดิม. email เป็น login alias เสริม, phone OTP คงเดิม.

**Tech Stack:** เพิ่ม `@react-navigation/native-stack` — ที่เหลือใช้ของ foundation (react-test-renderer, zustand, i18next, react-hook-form ยังไม่ใช้)

## Global Constraints

- **email เป็นทางเลือกเสริม** — login รับ username หรือ email เป็น identifier; register เก็บ email แบบ optional และไม่ OTP-verify; phone ยังเป็น verified channel เดียว (claude.md §4.2)
- **admin ไม่มีทางสมัคร** — ChooseAccountType เสนอแค่ user/rider ห้ามมี admin
- ทุกข้อความผ่าน i18n key ห้ามฝังสตริงไทย/อังกฤษใน component
- TextInput ทุกตัว `allowFontScaling={false}`, ใช้ `Text`/`Button` component กลาง
- เทสต์ใช้ **react-test-renderer** ไม่ใช่ @testing-library (ถอดออกแล้ว) — ดู pattern `__tests__/app/RootNavigator.test.tsx`
- validate เบอร์ไทย `^0[689]\d{8}$`; email validate แบบพื้นฐาน (มี @ และ domain)
- ก่อน commit ทุก task: `npm test` (ทั้งหมด) + `npx tsc --noEmit` ผ่าน
- commit conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task A: Account.email + mock login-by-identifier + authStore actions

**Files:**
- Modify: `src/data/types/index.ts` (Account + email, RegisterInput ผ่าน repositories)
- Modify: `src/data/repositories/index.ts` (RegisterInput + email, login param เป็น identifier)
- Modify: `src/data/mock/index.ts` (login match username OR email, register เก็บ email)
- Modify: `src/data/mock/seed.ts` (เพิ่ม email ให้ seed accounts)
- Modify: `src/features/auth/authStore.ts` (เพิ่ม action `register`, `verifyOtp`; login รับ identifier)
- Modify tests: `__tests__/data/mockRepos.test.ts`, `__tests__/features/authStore.test.ts`

**Interfaces (produces):**
- `Account.email?: string`
- `RegisterInput` เพิ่ม `email?: string`
- `AuthRepo.login(identifier: string, password: string)` — match username OR email
- `authStore.register(input): Promise<void>` — สมัครแล้ว login เข้าเลย (set account+capabilities)
- `authStore.verifyOtp(code): Promise<boolean>` — proxy ไป repos
- `authStore.login(identifier, password)` — เดิม แต่ param คือ identifier

**Test cases (เพิ่ม, TDD):**
- login ด้วย email ของ seed account สำเร็จ (เช่น `somchai@wingdai.test` / `1234`)
- login ด้วย username เดิมยังสำเร็จ
- login ด้วย identifier ที่ไม่มี → error key `auth.login.invalidCredentials`
- register user ใหม่พร้อม email → login ด้วย email นั้นได้
- register โดยไม่ใส่ email → login ด้วย username ได้
- register username ซ้ำ → error
- verifyOtp('123456') → true, code อื่น → false

- [ ] เขียน/แก้เทสต์ให้สะท้อนพฤติกรรมใหม่ → รันให้ล้ม
- [ ] แก้ types + repositories interface
- [ ] แก้ mock login (match `a.username === id || a.email === id`) + register เก็บ email
- [ ] เพิ่ม email ให้ seed ทั้ง 5 บัญชี (`<username>@wingdai.test`)
- [ ] เพิ่ม authStore.register + verifyOtp, ปรับ login param เป็น identifier
- [ ] `npm test` + `npx tsc --noEmit` ผ่าน → commit

---

## Task B: native-stack + AuthNavigator + RegisterScreen + wire Login

**Files:**
- Install: `npx expo install @react-navigation/native-stack`
- Create: `src/app/navigators/AuthNavigator.tsx` (native-stack: Login, Register, OtpVerify, ChooseAccountType, ForgotPassword)
- Modify: `src/app/RootNavigator.tsx` (ยังไม่ล็อกอิน → `<AuthNavigator/>` แทน `<LoginScreen/>` ตรง ๆ)
- Modify: `src/app/navigators/AuthStack.tsx` (Login: เปลี่ยน field เป็น identifier + ปุ่มลิงก์ไป Register และ ForgotPassword ผ่าน navigation)
- Create: `src/app/navigators/RegisterScreen.tsx`
- Modify: `src/i18n/locales/th.json` + `en.json` (เพิ่ม key ที่ขาด — ดูล่าง)
- Modify tests: `__tests__/app/RootNavigator.test.tsx` (ยังต้องผ่าน — AuthNavigator ครอบ Login), เพิ่ม `__tests__/app/RegisterScreen.test.tsx`

**i18n keys ที่ต้องเพิ่ม** (มี login/register/otp/chooseType/forgot อยู่แล้ว):
- `auth.login.identifier` = "ชื่อผู้ใช้หรืออีเมล" / "Username or email"
- `auth.register.username` = "ชื่อผู้ใช้" / "Username"
- `auth.register.email` = "อีเมล (ไม่บังคับ)" / "Email (optional)"
- `auth.register.emailInvalid` = "รูปแบบอีเมลไม่ถูกต้อง" / "Invalid email format"
- `auth.register.password` = "รหัสผ่าน" / "Password"
- `auth.register.usernameTaken` = "ชื่อผู้ใช้นี้ถูกใช้แล้ว" / "That username is taken"
- `auth.register.toLogin` = "มีบัญชีอยู่แล้ว เข้าสู่ระบบ" / "Already have an account? Log in"
- `common.back` มีแล้ว

**RegisterScreen fields:** username (required), email (optional), password (required), phone (required, `^0[689]\d{8}$`), fullName (required). validate ครบก่อนไป OtpVerify. ยังไม่ call register — carry form ผ่าน navigation param ไป OtpVerify.

**Login เปลี่ยน:** ช่อง username → `auth.login.identifier`, เพิ่มปุ่ม link `auth.login.toRegister` → navigate Register, ปุ่ม `auth.login.forgot` → navigate ForgotPassword.

**Test cases:**
- RootNavigator เดิม 7 เทสต์ยังผ่าน (ไรเดอร์ pending เห็น pending, ฯลฯ)
- RegisterScreen: กรอกไม่ครบ → มี error, กรอกครบ+เบอร์ผิด → error เบอร์, email ผิดรูปแบบ → error email
- Login มีปุ่มลิงก์ไป register (testID `link-register`)

- [ ] ติดตั้ง native-stack → เขียนเทสต์ RegisterScreen ล้มก่อน
- [ ] สร้าง AuthNavigator + RegisterScreen + เพิ่ม i18n keys
- [ ] แก้ Login (identifier + links) + RootNavigator ใช้ AuthNavigator
- [ ] `npm test` (RootNavigator เดิมยังผ่าน) + `tsc` → commit

---

## Task C: OtpVerify + ChooseAccountType (จบ register flow)

**Files:**
- Create: `src/app/navigators/OtpVerifyScreen.tsx`
- Create: `src/app/navigators/ChooseAccountTypeScreen.tsx`
- Modify: `AuthNavigator.tsx` (ผูกสองหน้านี้)
- Test: `__tests__/app/registerFlow.test.tsx`

**Flow:** Register (carry form) → OtpVerify (กรอก 6 หลัก, mock `123456`) → ChooseAccountType (user/rider) → เรียก `authStore.register({...form, accountType})` → เข้าแอปตาม capability (user → CustomerStack, rider → PendingApproval เพราะ rider ใหม่ = pending)

**OtpVerify:** ช่องกรอก 6 หลัก, ปุ่มยืนยัน → `authStore.verifyOtp(code)`; ผิด → error `auth.otp.invalid`; ถูก → navigate ChooseAccountType (carry form ต่อ)

**ChooseAccountType:** สองการ์ด user/rider (i18n มีแล้ว) → เลือกแล้ว register + เข้าแอป. **ห้ามมี admin**

**Test cases:**
- OtpVerify: code ผิด → error, ไม่ navigate; code `123456` → ไป ChooseAccountType
- ChooseAccountType เลือก user → register สำเร็จ → account ใน store เป็น user, activeCapability customer
- ChooseAccountType เลือก rider → register → account rider pending → capabilities ว่าง (ตรงกับ RootNavigator ส่งไป pending)
- ไม่มีปุ่ม/option admin (findAll admin length 0)

- [ ] เขียนเทสต์ flow ล้มก่อน
- [ ] สร้างสองหน้า + ผูก navigator
- [ ] `npm test` + `tsc` → commit

---

## Task D: ForgotPasswordScreen

**Files:**
- Create: `src/app/navigators/ForgotPasswordScreen.tsx`
- Modify: `AuthNavigator.tsx` (ผูกหน้านี้)
- Test: `__tests__/app/ForgotPassword.test.tsx`

**หน้า:** กรอกเบอร์โทร (`^0[689]\d{8}$`) → ปุ่มส่งรหัส (mock: แสดงข้อความสำเร็จ inline ว่าส่งแล้ว ไม่ทำ reset จริง — Phase 1 mock) → ปุ่มกลับ Login. i18n `auth.forgot.*` มีแล้ว เพิ่ม `auth.forgot.sent` = "ถ้าเบอร์นี้มีบัญชีอยู่ เราส่งรหัสไปแล้ว" / "If that number has an account, we've sent a code" (ข้อความกลาง ๆ ไม่เผยว่าเบอร์มีบัญชีไหม — กัน enumeration)

**Test cases:**
- เบอร์ผิดรูปแบบ → error, ไม่แสดง sent
- เบอร์ถูกรูปแบบ → แสดงข้อความ sent (ไม่ว่าเบอร์มีจริงไหม)

- [ ] เขียนเทสต์ล้มก่อน → สร้างหน้า + ผูก → `npm test` + `tsc` → commit

---

## เกณฑ์ผ่านของแผนนี้

1. `npm test` ผ่านทั้งหมด (95 เดิม + ใหม่) ไม่ skip
2. `npx tsc --noEmit` สะอาด
3. login ด้วย email seed (`somchai@wingdai.test`/`1234`) เข้าได้ · ด้วย username เดิมก็เข้าได้
4. หน้า Login มีลิงก์ไป Register และ ForgotPassword
5. register flow ครบ: Register → OTP(`123456`) → เลือก user → เข้า CustomerStack; เลือก rider → หน้ารออนุมัติ
6. ไม่มีทางเลือก admin ใน ChooseAccountType
7. เปิด browser (localhost:8081) กด "สมัครสมาชิก" แล้วเดินครบ flow ได้จริง

## ไม่ทำในแผนนี้
reset password จริง (mock), email OTP (email ไม่ verify), react-hook-form/zod (ใช้ validate ธรรมดาไปก่อน — form ยังเล็ก)
