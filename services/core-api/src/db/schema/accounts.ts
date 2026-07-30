import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  date,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { accountType, riderApprovalStatus } from './enums';
import { satang } from './money';
import { zones } from './zones';

/**
 * claude.md §4.2 · §7
 *
 * identifier ที่ใช้ล็อกอินคือ username หรือ phone — ทั้งคู่จึงต้อง unique
 * email เก็บไว้เป็นช่องทางรีเซ็ตรหัสอย่างเดียว ไม่ใช่ identifier และไม่ผ่าน OTP
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountType: accountType('account_type').notNull(),
    username: text('username').notNull(),
    /**
     * argon2id — ห้ามเก็บรหัสผ่านดิบ และห้าม bcrypt (จำกัด 72 ไบต์ ตัดรหัสผ่านไทยยาว ๆ ทิ้ง)
     *
     * เป็น null ได้ = บัญชีที่สมัครผ่าน Google อย่างเดียว ยังไม่เคยตั้งรหัสผ่าน
     * เก็บเป็น null ตรง ๆ ดีกว่าใส่ hash ปลอมไว้ เพราะ null บอกความจริงว่า
     * "ล็อกอินด้วยรหัสผ่านไม่ได้" ส่วน hash ปลอมยังมีโอกาสถูกเดาตรงในทางทฤษฎี
     * ถ้าอยากตั้งรหัสผ่านทีหลังให้ใช้เส้นทางลืมรหัสผ่าน (OTP ไปเบอร์ที่ยืนยันแล้ว)
     */
    passwordHash: text('password_hash'),
    /**
     * `sub` จาก Google id_token — เป็นตัวระบุตัวตนที่ Google การันตีว่าไม่เปลี่ยนและไม่ซ้ำ
     * **ห้ามใช้อีเมลผูกบัญชีแทน** เพราะอีเมลใน Google เปลี่ยนได้ และอีเมลฝั่งเราไม่เคยยืนยัน (§4.2)
     */
    googleSub: text('google_sub'),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    /** ยืนยันเบอร์ครั้งเดียวตอนสมัคร ไม่ใช่ทุกครั้งที่ล็อกอิน (claude.md §4.2) */
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** ปิดบัญชีแบบไม่ลบแถว — ออร์เดอร์เก่ายังต้องอ้างถึงได้ */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('accounts_username_key').on(t.username),
    uniqueIndex('accounts_phone_key').on(t.phone),
    uniqueIndex('accounts_google_sub_key').on(t.googleSub),
    index('accounts_email_idx').on(t.email),
    // เบอร์มือถือไทย 10 หลักขึ้นต้น 0 แล้วตามด้วย 6/8/9 — ตรงกับที่แอปตรวจในจอสมัคร
    check('accounts_phone_format', sql`${t.phone} ~ '^0[689][0-9]{8}$'`),
    // ต้องเข้าระบบได้อย่างน้อยหนึ่งทาง ไม่งั้นเป็นบัญชีที่สร้างแล้วเข้าไม่ได้ตลอดกาล
    check(
      'accounts_has_login_method',
      sql`${t.passwordHash} is not null or ${t.googleSub} is not null`,
    ),
  ],
);

/**
 * เอกสารและข้อมูลไรเดอร์ที่แอดมินต้องใช้อนุมัติ (claude.md §7)
 * แยกตารางเพราะบัญชี type 'user' ไม่มีข้อมูลชุดนี้เลย และเป็นข้อมูลอ่อนไหวตาม PDPA
 */
export const riderProfiles = pgTable(
  'rider_profiles',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    approval: riderApprovalStatus('approval').notNull().default('pending'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByAccountId: uuid('approved_by_account_id').references(() => accounts.id),
    rejectionReason: text('rejection_reason'),

    // ตัวตน
    nationalId: text('national_id').notNull(),
    dateOfBirth: date('date_of_birth').notNull(),

    // ยานพาหนะ — Phase 1 รับเฉพาะมอเตอร์ไซค์
    vehicleRegistration: text('vehicle_registration').notNull(),
    licenceExpiry: date('licence_expiry').notNull(),
    /** พ.ร.บ. — ต้องไม่หมดอายุ ไม่งั้นรับงานไม่ได้ */
    compulsoryInsuranceExpiry: date('compulsory_insurance_expiry').notNull(),

    // รับเงิน — ชื่อบัญชีควรตรงกับชื่อตามกฎหมาย เป็นด่านกันบัญชีม้า (claude.md §7)
    bankName: text('bank_name').notNull(),
    bankAccountNumber: text('bank_account_number').notNull(),
    bankAccountName: text('bank_account_name').notNull(),

    // ความปลอดภัย
    emergencyContactName: text('emergency_contact_name').notNull(),
    emergencyContactPhone: text('emergency_contact_phone').notNull(),

    preferredZoneId: uuid('preferred_zone_id').references(() => zones.id),

    /** ต้องมีทั้งคู่ก่อนอนุมัติ — สัญญาผู้รับจ้างอิสระ + ความยินยอม PDPA */
    contractSignedAt: timestamp('contract_signed_at', { withTimezone: true }),
    pdpaConsentAt: timestamp('pdpa_consent_at', { withTimezone: true }),

    /**
     * เงินสดที่ถืออยู่ตอนนี้ (สตางค์) — ยอดเดียวกับบัญชี rider_cash_held ใน ledger
     * เก็บซ้ำไว้ตรงนี้เพื่อให้เช็คเพดานตอนจ่ายงานได้เร็ว โดยไม่ต้องรวม ledger ทุกครั้ง
     * ledger ยังเป็นแหล่งความจริง ถ้าสองค่าไม่ตรงกันให้เชื่อ ledger แล้วแจ้งเตือนทันที
     */
    cashHeldSatang: satang('cash_held_satang').notNull().default(0),
    /** เกินเพดานแล้วห้ามจ่ายงานเงินสดให้ จนกว่าจะเคลียร์ — กันไรเดอร์ถือเงินบริษัทก้อนใหญ่ */
    cashLimitSatang: satang('cash_limit_satang').notNull().default(150000),
  },
  (t) => [
    index('rider_profiles_approval_idx').on(t.approval),
    check('rider_profiles_cash_held_non_negative', sql`${t.cashHeldSatang} >= 0`),
  ],
);

/** ไฟล์เอกสารไรเดอร์ — เก็บไฟล์จริงใน Supabase Storage ตารางนี้เก็บแค่ path กับสถานะตรวจ */
export const riderDocuments = pgTable(
  'rider_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    /** selfie | id_card_front | id_card_back | licence | vehicle_book | insurance */
    kind: text('kind').notNull(),
    storagePath: text('storage_path').notNull(),
    verified: boolean('verified').notNull().default(false),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('rider_documents_account_kind_key').on(t.accountId, t.kind)],
);
