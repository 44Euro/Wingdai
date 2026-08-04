import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { platformPricing, featureFlags } from '../db/schema';
import { writeAudit } from './audit.service';
import { DEFAULT_PRICING, type PricingConfig } from '../orders/pricing';

/** feature flag ที่ มีอยู่จริงและมีผลกับเซิร์ฟเวอร์ (design SA4) */
export const FEATURE_FLAG_KEYS = [
  /** ปิดได้ถ้าเงินสดค้างในมือไรเดอร์เยอะเกินคุม (§6.2) */
  'cash_payment',
  /** บัตรเครดิต/เดบิต เปิดใช้จริงตามที่เจ้าของโปรเจกต์สั่ง (2026-08-05) */
  'card_payment',
  /** §6.3 บอกให้เก็บทางแทรกมือไว้เสมอ ปิดตัวนี้คือกลับไปจ่ายงานด้วยมือทั้งหมด */
  'auto_dispatch',
  /** ปิดรับสมัครบัญชีใหม่ชั่วคราว */
  'registration_open',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  cash_payment: true,
  card_payment: true,
  auto_dispatch: true,
  registration_open: true,
};

/** ช่องทางจ่ายเงินที่ต้องมี flag เปิดถึงจะใช้ได้ */
export const PAYMENT_METHOD_NAMES = ['promptpay', 'cash', 'card'] as const;
export type PaymentMethodName = (typeof PAYMENT_METHOD_NAMES)[number];

const PAYMENT_METHOD_GATE = {
  cash: { flag: 'cash_payment', label: 'เงินสด' },
  card: { flag: 'card_payment', label: 'บัตร' },
} as const satisfies Partial<Record<PaymentMethodName, { flag: FeatureFlagKey; label: string }>>;

/** `undefined` = ช่องทางที่ปิดไม่ได้ (พร้อมเพย์) */
export function gateOfPaymentMethod(
  method: PaymentMethodName,
): { flag: FeatureFlagKey; label: string } | undefined {
  return PAYMENT_METHOD_GATE[method as keyof typeof PAYMENT_METHOD_GATE];
}

export type PricingView = PricingConfig & {
  updatedAt: string | null;
};

@Injectable()
export class PlatformService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** ราคาปัจจุบัน ยังไม่เคยตั้งค่าก็คืนค่าตั้งต้น ไม่ใช่ throw */
  async pricing(): Promise<PricingView> {
    const [row] = await this.db.select().from(platformPricing).limit(1);
    if (!row) return { ...DEFAULT_PRICING, updatedAt: null };

    return {
      commissionRateBp: row.commissionRateBp,
      deliveryBaseSatang: row.deliveryBaseSatang,
      deliveryPerKmSatang: row.deliveryPerKmSatang,
      serviceFeeSatang: row.serviceFeeSatang,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** เปลี่ยนราคา ยืนยันแล้วต้องลง audit ในทรานแซกชันเดียวกัน */
  async setPricing(actorId: string, next: PricingConfig): Promise<PricingView> {
    for (const [key, value] of Object.entries(next)) {
      if (!Number.isInteger(value)) {
        throw new BadRequestException({
          message: 'ค่าธรรมเนียมทุกช่องต้องเป็นจำนวนเต็มสตางค์',
          fields: { [key]: 'ต้องเป็นจำนวนเต็ม' },
        });
      }
    }

    return this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(platformPricing).limit(1);

      const [row] = await tx
        .insert(platformPricing)
        .values({ singleton: true, ...next, updatedByAccountId: actorId, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: platformPricing.singleton,
          set: { ...next, updatedByAccountId: actorId, updatedAt: new Date() },
        })
        .returning();

      await writeAudit(tx, {
        actorId,
        action: 'pricing.changed',
        subjectType: 'platform_pricing',
        subjectId: 'singleton',
        before: before
          ? {
            commissionRateBp: before.commissionRateBp,
            deliveryBaseSatang: before.deliveryBaseSatang,
            deliveryPerKmSatang: before.deliveryPerKmSatang,
            serviceFeeSatang: before.serviceFeeSatang,
          }
          : DEFAULT_PRICING,
        after: next,
      });

      return {
        commissionRateBp: row!.commissionRateBp,
        deliveryBaseSatang: row!.deliveryBaseSatang,
        deliveryPerKmSatang: row!.deliveryPerKmSatang,
        serviceFeeSatang: row!.serviceFeeSatang,
        updatedAt: row!.updatedAt.toISOString(),
      };
    });
  }

  /** flag ทุกตัวพร้อมค่าปัจจุบัน ตัวที่ยังไม่เคยตั้งใช้ค่าตั้งต้น ไม่ใช่หายไปจากรายการ */
  async flags(): Promise<Record<FeatureFlagKey, boolean>> {
    const rows = await this.db.select().from(featureFlags);
    const byKey = new Map(rows.map((r) => [r.key, r.enabled]));

    const out = {} as Record<FeatureFlagKey, boolean>;
    for (const key of FEATURE_FLAG_KEYS) out[key] = byKey.get(key) ?? DEFAULT_FLAGS[key];
    return out;
  }

  /** ช่องทางจ่ายเงินที่เซิร์ฟเวอร์ยอมรับ จริง ตอนนี้ */
  async availablePaymentMethods(known?: Record<FeatureFlagKey, boolean>): Promise<PaymentMethodName[]> {
    const flags = known ?? (await this.flags());
    return PAYMENT_METHOD_NAMES.filter((m) => {
      const gate = gateOfPaymentMethod(m);
      return gate === undefined || flags[gate.flag];
    });
  }

  /** อ่าน flag ตัวเดียวสำหรับโค้ดที่ต้องตัดสินใจตามมัน (เช่น กันสร้างออร์เดอร์เงินสด) */
  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const [row] = await this.db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);
    return row?.enabled ?? DEFAULT_FLAGS[key];
  }

  async setFlag(actorId: string, key: FeatureFlagKey, enabled: boolean) {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select({ enabled: featureFlags.enabled })
        .from(featureFlags)
        .where(eq(featureFlags.key, key))
        .limit(1);

      await tx
        .insert(featureFlags)
        .values({ key, enabled, updatedByAccountId: actorId, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: { enabled, updatedByAccountId: actorId, updatedAt: new Date() },
        });

      await writeAudit(tx, {
        actorId,
        action: 'flag.changed',
        subjectType: 'feature_flag',
        subjectId: key,
        before: { enabled: before?.enabled ?? DEFAULT_FLAGS[key] },
        after: { enabled },
      });

      return { key, enabled };
    });
  }
}
