import {
  Injectable, Inject, NotFoundException, ForbiddenException, ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { and, eq, desc, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import {
  accounts, riderProfiles, riderStatus, riderSessions, dispatchOffers,
  orders, orderItems, restaurants, addresses, zones, ledgerEntries, riderPayouts, riderIssues,
  riderDocuments,
} from '../db/schema';
import { randomUUID } from 'node:crypto';
import { postCashSettlement } from '../ledger/postCashSettlement';
import { postPayout, withdrawableSatang, assertWithdrawAllowed } from '../ledger/postPayout';
import { DispatchService } from './dispatch.service';
import { MAX_ACTIVE_JOBS } from './scoring';
import { validateRiderApplication, bankNameMatchesLegalName } from './riderApplication';
import { periodStart, periodDays, type EarningsPeriod } from './earningsPeriod';
import { canReportIssue, type RiderIssueKind } from './riderIssue';
import { RIDER_DOCUMENT_KINDS, type RiderDocumentKind } from '../storage/storage.controller';
import { StorageService } from '../storage/storage.service';

/** สถานะเอกสารหนึ่งชนิดตามที่ไรเดอร์เห็น (design R8) */
export type RiderDocumentView = {
  kind: RiderDocumentKind;
  status: 'missing' | 'reviewing' | 'verified' | 'rejected';
  rejectionReason: string | null;
  uploadedAt: string | null;
};

/** เอกสารชุดเดียวกันตามที่แอดมินเห็น (design AD6) มีลิงก์ดูรูปเพิ่มมา */
export type RiderDocumentAdminView = RiderDocumentView & {
  /** signed URL อายุสั้น null = ยังไม่ส่งเอกสารชนิดนี้ จึงไม่มีอะไรให้ดู */
  url: string | null;
};

/** งานที่ไรเดอร์ถืออยู่ = ยังไม่ส่งถึงและยังไม่ถูกยกเลิก */
const ACTIVE_JOB_STATUSES = ['accepted', 'preparing', 'picked_up'] as const;

export type RiderJob = {
  orderId: string;
  reference: string;
  status: 'accepted' | 'preparing' | 'picked_up';
  restaurantName: string;
  restaurantAddress: string;
  restaurantLat: number;
  restaurantLng: number;
  dropoffAddress: string;
  dropoffNote: string | null;
  dropoffLat: number;
  dropoffLng: number;
  /** ของในถุงตามที่ไรเดอร์ต้องตรวจก่อนออกจากร้าน (design R10) */
  items: { name: string; quantity: number; note: string | null; choiceNames: string[] }[];
  /** §6.3 เวลาทำที่ร้านตั้งไว้ + เวลาที่ร้านรับออร์เดอร์ = อีกกี่นาทีอาหารเสร็จ */
  prepTimeMinutes: number;
  acceptedAt: string | null;
  /** ค่าส่งคือรายได้ของไรเดอร์ใบนี้ ไม่ใช่ยอดที่ลูกค้าจ่ายทั้งหมด */
  riderPaySatang: number;
  /** ต้องเก็บเงินสดกี่บาท 0 = ลูกค้าจ่ายมาแล้ว */
  collectCashSatang: number;
  /** ลูกค้าขอให้วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
  leaveAtDoor: boolean;
};

@Injectable()
export class RiderService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly dispatch: DispatchService,
    private readonly storage: StorageService,
  ) {}

  /** ต้องเป็นบัญชี rider ที่อนุมัติแล้วเท่านั้น บัญชี user เข้าเส้นทางนี้ไม่ได้เลย */
  private async requireApprovedRider(accountId: string) {
    const [row] = await this.db
      .select({ approval: riderProfiles.approval, accountType: accounts.accountType })
      .from(accounts)
      .leftJoin(riderProfiles, eq(riderProfiles.accountId, accounts.id))
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (row?.accountType !== 'rider') throw new NotFoundException({ message: 'ไม่พบงานของไรเดอร์' });
    if (row.approval !== 'approved') {
      throw new ForbiddenException({ message: 'บัญชีไรเดอร์ยังรออนุมัติ' });
    }
  }

  /** โซนที่เปิดให้บริการ ใบสมัครต้องเลือกโซนที่อยากวิ่ง (product-spec §7) */
  async activeZones() {
    return this.db
      .select({ id: zones.id, name: zones.name, type: zones.type })
      .from(zones)
      .where(eq(zones.isActive, true))
      .orderBy(zones.name);
  }

  /** ใบสมัครไรเดอร์ของบัญชีนี้ (design R5) */
  async application(accountId: string) {
    const [row] = await this.db
      .select()
      .from(riderProfiles)
      .where(eq(riderProfiles.accountId, accountId))
      .limit(1);

    if (!row) return { status: 'none' as const, profile: null, rejectionReason: null };

    return {
      status: row.approval,
      rejectionReason: row.rejectionReason,
      profile: {
        nationalId: row.nationalId,
        dateOfBirth: row.dateOfBirth,
        vehicleRegistration: row.vehicleRegistration,
        licenceExpiry: row.licenceExpiry,
        compulsoryInsuranceExpiry: row.compulsoryInsuranceExpiry,
        bankName: row.bankName,
        bankAccountNumber: row.bankAccountNumber,
        bankAccountName: row.bankAccountName,
        emergencyContactName: row.emergencyContactName,
        emergencyContactPhone: row.emergencyContactPhone,
        preferredZoneId: row.preferredZoneId,
      },
    };
  }

  /** ส่ง/ส่งใหม่ใบสมัครไรเดอร์ */
  async submitApplication(
    accountId: string,
    input: {
      nationalId: string;
      dateOfBirth: string;
      vehicleRegistration: string;
      licenceExpiry: string;
      compulsoryInsuranceExpiry: string;
      bankName: string;
      bankAccountNumber: string;
      bankAccountName: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      preferredZoneId?: string;
      acceptContract: boolean;
      acceptPdpa: boolean;
    },
  ) {
    const [account] = await this.db
      .select({ accountType: accounts.accountType, fullName: accounts.fullName })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    // บัญชี user เดินเส้นทางนี้ไม่ได้ ไรเดอร์เลือกตอนสมัครบัญชี ไม่ใช่ความสามารถที่เพิ่มทีหลัง (§4.1)
    if (account?.accountType !== 'rider') {
      throw new ForbiddenException({ message: 'เฉพาะบัญชีไรเดอร์เท่านั้นที่ส่งใบสมัครนี้ได้' });
    }

    const existing = await this.application(accountId);
    if (existing.status === 'approved') {
      throw new ConflictException({ message: 'ใบสมัครได้รับการอนุมัติแล้ว แก้ไขข้อมูลเองไม่ได้' });
    }
    if (existing.status === 'pending') {
      throw new ConflictException({ message: 'ส่งใบสมัครไปแล้ว กำลังรอตรวจสอบ' });
    }

    // §7 ทั้งสัญญาผู้รับจ้างอิสระและความยินยอม PDPA ต้องมีก่อนอนุมัติ ไม่มีก็ไม่รับใบสมัคร
    if (!input.acceptContract || !input.acceptPdpa) {
      throw new BadRequestException({
        fields: {
          ...(input.acceptContract ? {} : { acceptContract: 'ต้องยอมรับสัญญาผู้รับจ้างอิสระ' }),
          ...(input.acceptPdpa ? {} : { acceptPdpa: 'ต้องยินยอมให้เก็บข้อมูลตาม PDPA' }),
        },
      });
    }

    const fields = validateRiderApplication(input, new Date());
    if (Object.keys(fields).length > 0) throw new BadRequestException({ fields });

    if (input.preferredZoneId) {
      const [zone] = await this.db
        .select({ id: zones.id })
        .from(zones)
        .where(and(eq(zones.id, input.preferredZoneId), eq(zones.isActive, true)))
        .limit(1);
      if (!zone) throw new BadRequestException({ fields: { preferredZoneId: 'ไม่พบโซนนี้' } });
    }

    const now = new Date();
    const values = {
      accountId,
      approval: 'pending' as const,
      // ส่งใหม่หลังถูกปฏิเสธ ต้องล้างเหตุผลเก่าทิ้ง ไม่งั้นจอจะโชว์เหตุผลของรอบก่อนค้างไว้
      rejectionReason: null,
      nationalId: input.nationalId.replace(/\D/g, ''),
      dateOfBirth: input.dateOfBirth,
      vehicleRegistration: input.vehicleRegistration.trim(),
      licenceExpiry: input.licenceExpiry,
      compulsoryInsuranceExpiry: input.compulsoryInsuranceExpiry,
      bankName: input.bankName.trim(),
      bankAccountNumber: input.bankAccountNumber.replace(/\D/g, ''),
      bankAccountName: input.bankAccountName.trim(),
      emergencyContactName: input.emergencyContactName.trim(),
      emergencyContactPhone: input.emergencyContactPhone.replace(/\D/g, ''),
      preferredZoneId: input.preferredZoneId ?? null,
      contractSignedAt: now,
      pdpaConsentAt: now,
    };

    await this.db
      .insert(riderProfiles)
      .values(values)
      .onConflictDoUpdate({ target: riderProfiles.accountId, set: values });

    return this.application(accountId);
  }

  /** ใบสมัครที่รอแอดมินตรวจ (§7) */
  async pendingApplications() {
    const rows = await this.db
      .select({
        accountId: riderProfiles.accountId,
        fullName: accounts.fullName,
        phone: accounts.phone,
        nationalId: riderProfiles.nationalId,
        dateOfBirth: riderProfiles.dateOfBirth,
        vehicleRegistration: riderProfiles.vehicleRegistration,
        licenceExpiry: riderProfiles.licenceExpiry,
        compulsoryInsuranceExpiry: riderProfiles.compulsoryInsuranceExpiry,
        bankName: riderProfiles.bankName,
        bankAccountNumber: riderProfiles.bankAccountNumber,
        bankAccountName: riderProfiles.bankAccountName,
        emergencyContactName: riderProfiles.emergencyContactName,
        emergencyContactPhone: riderProfiles.emergencyContactPhone,
        zoneName: zones.name,
      })
      .from(riderProfiles)
      .innerJoin(accounts, eq(accounts.id, riderProfiles.accountId))
      .leftJoin(zones, eq(zones.id, riderProfiles.preferredZoneId))
      .where(eq(riderProfiles.approval, 'pending'))
      .orderBy(riderProfiles.accountId);

    return rows.map((r) => ({
      ...r,
      bankNameMatches: bankNameMatchesLegalName(r.bankAccountName, r.fullName),
    }));
  }

  /** ไรเดอร์ที่ยังถือเงินสดของบริษัทอยู่ (§6.2) */
  async ridersHoldingCash() {
    const rows = await this.db
      .select({
        accountId: riderProfiles.accountId,
        fullName: accounts.fullName,
        phone: accounts.phone,
        cashHeldSatang: riderProfiles.cashHeldSatang,
        cashLimitSatang: riderProfiles.cashLimitSatang,
      })
      .from(riderProfiles)
      .innerJoin(accounts, eq(accounts.id, riderProfiles.accountId))
      .where(sql`${riderProfiles.cashHeldSatang} > 0`)
      .orderBy(desc(riderProfiles.cashHeldSatang));

    return rows.map((r) => ({
      ...r,
      // ชนเพดานแล้ว = eligibility.ts จะไม่เสนองานเงินสดให้อีกจนกว่าจะเคลียร์
      atLimit: r.cashHeldSatang >= r.cashLimitSatang,
    }));
  }

  /** ไรเดอร์นำเงินสดมาส่งคืนบริษัท แล้วแอดมินบันทึก (product-spec §6.2) */
  async settleCash(adminAccountId: string, riderAccountId: string, amountSatang: number) {
    if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
      throw new BadRequestException({ fields: { amountSatang: 'ยอดนำส่งต้องเป็นจำนวนเต็มสตางค์ที่มากกว่าศูนย์' } });
    }

    return this.db.transaction(async (tx) => {
      const [profile] = await tx
        .select({ cashHeld: riderProfiles.cashHeldSatang })
        .from(riderProfiles)
        .where(eq(riderProfiles.accountId, riderAccountId))
        .limit(1)
        .for('update');

      if (!profile) throw new NotFoundException({ message: 'ไม่พบโปรไฟล์ไรเดอร์' });

      /** รับเกินยอดที่ถืออยู่ไม่ได้ ฐานมี CHECK กัน cash_held ติดลบอยู่แล้ว แต่ถ้าปล่อยให้ */
      if (amountSatang > profile.cashHeld) {
        throw new ConflictException({
          message: `ยอดนำส่งเกินเงินสดที่ไรเดอร์ถืออยู่ (${profile.cashHeld} สตางค์)`,
        });
      }

      await tx
        .update(riderProfiles)
        .set({ cashHeldSatang: sql`${riderProfiles.cashHeldSatang} - ${amountSatang}` })
        .where(eq(riderProfiles.accountId, riderAccountId));

      const entryGroupId = randomUUID();
      await tx.insert(ledgerEntries).values(
        postCashSettlement({ amountSatang }).map((l) => ({
          entryGroupId,
          account: l.account,
          debitSatang: l.debitSatang,
          creditSatang: l.creditSatang,
          // ผูกกับไรเดอร์ ไม่ใช่ออร์เดอร์ เงินก้อนนี้มาจากหลายใบรวมกัน
          counterpartyAccountId: riderAccountId,
          reason: 'rider.cash_settled',
        })),
      );

      return {
        riderAccountId,
        settledSatang: amountSatang,
        cashHeldSatang: profile.cashHeld - amountSatang,
        recordedByAccountId: adminAccountId,
      };
    });
  }

  /** จุดตั้งทำงานของไรเดอร์ (design R7) */
  async workBase(accountId: string) {
    const [row] = await this.db
      .select({ base: riderStatus.baseLocation, radiusKm: riderStatus.baseRadiusKm })
      .from(riderStatus)
      .where(eq(riderStatus.accountId, accountId))
      .limit(1);

    if (!row?.base) return null;
    // PostGIS เรียง (x, y) = (lng, lat) ซึ่งสลับกับที่คนพูดกันว่า "lat, lng"
    return { lat: row.base.y, lng: row.base.x, radiusKm: row.radiusKm };
  }

  async setWorkBase(
    accountId: string,
    input: { lat: number; lng: number; radiusKm: number },
  ) {
    await this.requireApprovedRider(accountId);
    const values = {
      accountId,
      baseLocation: { x: input.lng, y: input.lat },
      baseRadiusKm: input.radiusKm,
    };
    await this.db
      .insert(riderStatus)
      .values(values)
      .onConflictDoUpdate({ target: riderStatus.accountId, set: values });
    return this.workBase(accountId);
  }

  /** ยอดเงินของไรเดอร์ (design R12) */
  async balance(accountId: string) {
    const [row] = await this.db.execute<{ payable: string }>(sql`
      select coalesce(sum(${ledgerEntries.creditSatang} - ${ledgerEntries.debitSatang}), 0) as payable
        from ${ledgerEntries}
       where ${ledgerEntries.counterpartyAccountId} = ${accountId}
         and ${ledgerEntries.account} = 'rider_payable'
    `);

    const [profile] = await this.db
      .select({ cashHeld: riderProfiles.cashHeldSatang })
      .from(riderProfiles)
      .where(eq(riderProfiles.accountId, accountId))
      .limit(1);

    const payableSatang = Number(row?.payable ?? 0);
    const cashHeldSatang = profile?.cashHeld ?? 0;

    const [pending] = await this.db
      .select()
      .from(riderPayouts)
      .where(and(eq(riderPayouts.accountId, accountId), eq(riderPayouts.status, 'requested')))
      .limit(1);

    return {
      payableSatang,
      cashHeldSatang,
      withdrawableSatang: withdrawableSatang({ payableSatang, cashHeldSatang }),
      pending: pending ?? null,
    };
  }

  /** ไรเดอร์ขอถอนเงิน ยังไม่มีเงินออกจนกว่าแอดมินจะยืนยัน (product-spec §6.4) */
  async requestPayout(accountId: string, amountSatang: number) {
    await this.requireApprovedRider(accountId);
    const b = await this.balance(accountId);

    if (b.pending) {
      throw new ConflictException({ message: 'มีคำขอถอนที่รอแอดมินยืนยันอยู่แล้ว' });
    }

    try {
      assertWithdrawAllowed({ amountSatang, ...b });
    } catch (e) {
      throw new BadRequestException({ fields: { amountSatang: (e as Error).message } });
    }

    const [created] = await this.db
      .insert(riderPayouts)
      .values({ accountId, amountSatang })
      .returning();

    return created;
  }

  /** คำขอที่รอแอดมินตัดสิน */
  async pendingPayouts() {
    return this.db
      .select({
        id: riderPayouts.id,
        accountId: riderPayouts.accountId,
        fullName: accounts.fullName,
        phone: accounts.phone,
        amountSatang: riderPayouts.amountSatang,
        requestedAt: riderPayouts.requestedAt,
      })
      .from(riderPayouts)
      .innerJoin(accounts, eq(accounts.id, riderPayouts.accountId))
      .where(eq(riderPayouts.status, 'requested'))
      .orderBy(riderPayouts.requestedAt);
  }

  /** แอดมินยืนยันหรือปฏิเสธคำขอถอน */
  async decidePayout(
    adminAccountId: string,
    payoutId: string,
    approve: boolean,
    rejectionReason?: string,
  ) {
    if (!approve && !rejectionReason?.trim()) {
      throw new BadRequestException({ fields: { rejectionReason: 'ปฏิเสธต้องบอกเหตุผล' } });
    }

    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(riderPayouts)
        .where(eq(riderPayouts.id, payoutId))
        .limit(1)
        .for('update');

      if (!p) throw new NotFoundException({ message: 'ไม่พบคำขอถอน' });
      if (p.status !== 'requested') {
        throw new ConflictException({ message: 'คำขอนี้ถูกตัดสินไปแล้ว' });
      }

      if (!approve) {
        const [rejected] = await tx
          .update(riderPayouts)
          .set({
            status: 'rejected',
            rejectionReason: rejectionReason!.trim(),
            decidedAt: new Date(),
          })
          .where(eq(riderPayouts.id, payoutId))
          .returning();
        return { ...rejected, recordedByAccountId: adminAccountId };
      }

      const b = await this.balance(p.accountId);
      try {
        assertWithdrawAllowed({ amountSatang: p.amountSatang, ...b });
      } catch (e) {
        throw new ConflictException({ message: (e as Error).message });
      }

      const entryGroupId = randomUUID();
      await tx.insert(ledgerEntries).values(
        postPayout({ amountSatang: p.amountSatang }).map((l) => ({
          entryGroupId,
          account: l.account,
          debitSatang: l.debitSatang,
          creditSatang: l.creditSatang,
          counterpartyAccountId: p.accountId,
          reason: 'rider.payout',
        })),
      );

      const [paid] = await tx
        .update(riderPayouts)
        .set({ status: 'paid', decidedAt: new Date() })
        .where(eq(riderPayouts.id, payoutId))
        .returning();

      return { ...paid, recordedByAccountId: adminAccountId };
    });
  }

  /** แอดมินอนุมัติ/ปฏิเสธ ปฏิเสธต้องมีเหตุผล ไม่งั้นไรเดอร์ไม่รู้ว่าต้องแก้อะไรแล้วส่งใหม่ */
  async decideApplication(
    adminAccountId: string,
    riderAccountId: string,
    approve: boolean,
    rejectionReason?: string,
  ) {
    if (!approve && !rejectionReason?.trim()) {
      throw new BadRequestException({ fields: { rejectionReason: 'ต้องบอกเหตุผลที่ปฏิเสธ' } });
    }

    const [row] = await this.db
      .update(riderProfiles)
      .set({
        approval: approve ? 'approved' : 'rejected',
        approvedAt: approve ? new Date() : null,
        approvedByAccountId: adminAccountId,
        rejectionReason: approve ? null : rejectionReason!.trim(),
      })
      .where(eq(riderProfiles.accountId, riderAccountId))
      .returning({ accountId: riderProfiles.accountId });

    if (!row) throw new NotFoundException({ message: 'ไม่พบใบสมัครนี้' });
    return this.application(riderAccountId);
  }

  async status(accountId: string) {
    const [profile] = await this.db
      .select({ approval: riderProfiles.approval, cashHeld: riderProfiles.cashHeldSatang, cashLimit: riderProfiles.cashLimitSatang })
      .from(riderProfiles)
      .where(eq(riderProfiles.accountId, accountId))
      .limit(1);

    if (!profile) throw new NotFoundException({ message: 'ไม่พบโปรไฟล์ไรเดอร์' });

    const [state] = await this.db
      .select()
      .from(riderStatus)
      .where(eq(riderStatus.accountId, accountId))
      .limit(1);

    return {
      approval: profile.approval,
      isOnline: state?.isOnline ?? false,
      onlineSince: state?.onlineSince?.toISOString() ?? null,
      /** §6.2 เกินเพดานแล้วจะไม่ได้งานเงินสดต่อ จอต้องบอกล่วงหน้า ไม่ใช่ให้งงว่าทำไมงานหาย */
      cashHeldSatang: profile.cashHeld,
      cashLimitSatang: profile.cashLimit,
      /** ตำแหน่งล่าสุดที่ไรเดอร์ส่งมา จอ R7 ใช้เป็นหมุดตั้งต้นตอนยังไม่เคยตั้งจุดทำงาน */
      lastLocation: state?.location ? { lat: state.location.y, lng: state.location.x } : null,
      activeJobs: await this.jobs(accountId),
      offer: await this.currentOffer(accountId),
    };
  }

  /** เปิด/ปิดรับงาน */
  async setOnline(accountId: string, isOnline: boolean, at: { lat: number; lng: number } | null) {
    await this.requireApprovedRider(accountId);

    if (isOnline && !at) {
      // ไม่รู้ว่าอยู่ไหน = จ่ายงานให้ไม่ได้ (คะแนนคิดจากระยะทาง) จึงไม่ให้ออนไลน์แบบไม่มีพิกัด
      throw new ConflictException({ message: 'ต้องเปิดตำแหน่งก่อนเริ่มรับงาน' });
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(riderStatus)
        .where(eq(riderStatus.accountId, accountId))
        .limit(1);

      const location = at ? { x: at.lng, y: at.lat } : (existing?.location ?? null);

      await tx
        .insert(riderStatus)
        .values({
          accountId,
          isOnline,
          location,
          lastPingAt: at ? now : existing?.lastPingAt,
          onlineSince: isOnline ? (existing?.onlineSince ?? now) : null,
        })
        .onConflictDoUpdate({
          target: riderStatus.accountId,
          set: {
            isOnline,
            location,
            lastPingAt: at ? now : existing?.lastPingAt,
            onlineSince: isOnline ? (existing?.onlineSince ?? now) : null,
          },
        });

      // ปิดช่วงเก่าที่ค้างไว้เสมอ แอปถูก kill กลางทางแล้วช่วงเดิมจะค้างจนตัวหารเพี้ยน
      await tx
        .update(riderSessions)
        .set({ offlineAt: now })
        .where(and(eq(riderSessions.accountId, accountId), isNull(riderSessions.offlineAt)));

      if (isOnline) await tx.insert(riderSessions).values({ accountId, onlineAt: now });
    });

    return this.status(accountId);
  }

  /** ส่งพิกัดปัจจุบัน product-spec §5 ทุก 3–5 วิ ตอนกำลังส่ง / 15–30 วิ ตอนออนไลน์เฉย ๆ */
  async ping(accountId: string, lat: number, lng: number) {
    const [row] = await this.db
      .update(riderStatus)
      .set({ location: { x: lng, y: lat }, lastPingAt: new Date() })
      .where(eq(riderStatus.accountId, accountId))
      .returning({ accountId: riderStatus.accountId });

    if (!row) throw new NotFoundException({ message: 'ต้องเปิดรับงานก่อนส่งตำแหน่ง' });
    return { ok: true };
  }

  /** ข้อเสนอที่ยังรอคำตอบอยู่ จอรับงาน 15 วินาที (§6.3) */
  private async currentOffer(accountId: string) {
    const [offer] = await this.db
      .select({
        id: dispatchOffers.id,
        orderId: dispatchOffers.orderId,
        expiresAt: dispatchOffers.expiresAt,
      })
      .from(dispatchOffers)
      .where(and(eq(dispatchOffers.riderId, accountId), eq(dispatchOffers.outcome, 'pending')))
      .orderBy(desc(dispatchOffers.offeredAt))
      .limit(1);

    if (!offer) return null;
    // หมดเวลาไปแล้วแต่รอบกวาดยังไม่ถึง อย่าโชว์งานที่กดรับไม่ได้แล้ว
    if (offer.expiresAt.getTime() <= Date.now()) return null;

    const job = await this.jobDetail(offer.orderId);
    return job ? { ...job, offerId: offer.id, expiresAt: offer.expiresAt.toISOString() } : null;
  }

  async acceptOffer(accountId: string, orderId: string): Promise<RiderJob> {
    await this.requireApprovedRider(accountId);

    await this.db.transaction(async (tx) => {
      const [offer] = await tx
        .select()
        .from(dispatchOffers)
        .where(and(eq(dispatchOffers.orderId, orderId), eq(dispatchOffers.riderId, accountId)))
        .limit(1)
        .for('update');

      if (!offer) throw new NotFoundException({ message: 'ไม่พบงานนี้' });
      if (offer.outcome !== 'pending') {
        throw new ConflictException({ message: 'งานนี้ตอบไปแล้วหรือหมดเวลาแล้ว' });
      }
      if (offer.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException({ message: 'หมดเวลารับงานนี้แล้ว' });
      }

      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
      if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
      // มีคนรับไปแล้วระหว่างที่กด เกิดได้จริงถ้าแอดมินจ่ายงานมือพร้อมกัน (§6.3)
      if (order.riderId) throw new ConflictException({ message: 'งานนี้มีคนรับไปแล้ว' });

      /** product-spec §4.3 ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้ */
      if (order.customerId === accountId) {
        throw new ForbiddenException({ message: 'รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้' });
      }

      const busy = await this.dispatch.activeJobCount(accountId);
      if (busy >= MAX_ACTIVE_JOBS) {
        throw new ConflictException({ message: 'ถืองานเต็มมือแล้ว ส่งของที่มีอยู่ให้เสร็จก่อน' });
      }

      await tx.update(orders).set({ riderId: accountId }).where(eq(orders.id, orderId));
      await tx
        .update(dispatchOffers)
        .set({ outcome: 'accepted', respondedAt: new Date() })
        .where(eq(dispatchOffers.id, offer.id));
    });

    return (await this.jobDetail(orderId))!;
  }

  /** ปฏิเสธ รอบจ่ายงานถัดไปจะเลื่อนไปคนต่อไปเอง ไม่ต้องมีเส้นทางแยก */
  async declineOffer(accountId: string, orderId: string) {
    const rows = await this.db
      .update(dispatchOffers)
      .set({ outcome: 'declined', respondedAt: new Date() })
      .where(
        and(
          eq(dispatchOffers.orderId, orderId),
          eq(dispatchOffers.riderId, accountId),
          eq(dispatchOffers.outcome, 'pending'),
        ),
      )
      .returning({ id: dispatchOffers.id });

    if (rows.length === 0) throw new NotFoundException({ message: 'ไม่พบงานนี้' });
    return { ok: true };
  }

  /** ไรเดอร์แจ้งปัญหาระหว่างส่ง (design R9) */
  async reportIssue(
    accountId: string,
    orderId: string,
    input: { kind: RiderIssueKind; detail?: string },
  ) {
    const [order] = await this.db
      .select({ id: orders.id, riderId: orders.riderId, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.riderId !== accountId) {
      throw new NotFoundException({ message: 'ไม่พบงานนี้' });
    }
    if (!canReportIssue(order.status)) {
      throw new ConflictException({ message: 'งานนี้จบไปแล้ว แจ้งปัญหาผ่านช่องนี้ไม่ได้' });
    }

    const [row] = await this.db
      .insert(riderIssues)
      .values({
        orderId,
        riderId: accountId,
        kind: input.kind,
        detail: input.detail?.length ? input.detail : null,
      })
      .returning({ id: riderIssues.id, createdAt: riderIssues.createdAt });

    return {
      id: row!.id,
      orderId,
      kind: input.kind,
      createdAt: row!.createdAt.toISOString(),
    };
  }

  /** เอกสารของไรเดอร์คนนี้ (design R8 product-spec §7) */
  async documents(accountId: string): Promise<RiderDocumentView[]> {
    const rows = await this.db
      .select()
      .from(riderDocuments)
      .where(eq(riderDocuments.accountId, accountId));

    const byKind = new Map(rows.map((r) => [r.kind, r]));

    return RIDER_DOCUMENT_KINDS.map((kind) => {
      const row = byKind.get(kind);
      if (!row) {
        return { kind, status: 'missing' as const, rejectionReason: null, uploadedAt: null };
      }
      return {
        kind,
        status: row.verified
          ? ('verified' as const)
          : row.rejectionReason
            ? ('rejected' as const)
            : ('reviewing' as const),
        rejectionReason: row.rejectionReason,
        uploadedAt: row.uploadedAt.toISOString(),
      };
    });
  }

  /** เอกสารของไรเดอร์คนหนึ่งพร้อมลิงก์ดูรูป สำหรับจอตรวจ KYC ของแอดมิน (design AD6) */
  async documentsForAdmin(accountId: string): Promise<RiderDocumentAdminView[]> {
    const views = await this.documents(accountId);

    const rows = await this.db
      .select({ kind: riderDocuments.kind, storagePath: riderDocuments.storagePath })
      .from(riderDocuments)
      .where(eq(riderDocuments.accountId, accountId));
    const pathByKind = new Map(rows.map((r) => [r.kind, r.storagePath]));

    return Promise.all(
      views.map(async (v) => {
        const path = pathByKind.get(v.kind);
        return {
          ...v,
          url: path ? await this.storage.signDownload('rider-docs', path) : null,
        };
      }),
    );
  }

  /** บันทึกว่าอัปโหลดไฟล์ไปที่ไหนแล้ว */
  async saveDocument(accountId: string, kind: RiderDocumentKind, storagePath: string) {
    if (!storagePath.startsWith(`${accountId}/`)) {
      throw new ForbiddenException({ message: 'เส้นทางไฟล์ไม่ใช่ของบัญชีนี้' });
    }

    await this.db
      .insert(riderDocuments)
      .values({ accountId, kind, storagePath })
      .onConflictDoUpdate({
        target: [riderDocuments.accountId, riderDocuments.kind],
        set: {
          storagePath,
          verified: false,
          rejectionReason: null,
          uploadedAt: new Date(),
        },
      });

    return (await this.documents(accountId)).find((d) => d.kind === kind)!;
  }

  /** แอดมินตัดสินเอกสารหนึ่งใบ (design R8) */
  async decideDocument(
    accountId: string,
    kind: string,
    input: { approve: boolean; rejectionReason?: string },
  ): Promise<RiderDocumentView> {
    if (!(RIDER_DOCUMENT_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException({ message: `ไม่รู้จักเอกสารชนิด ${kind}` });
    }
    if (!input.approve && !input.rejectionReason?.trim()) {
      throw new BadRequestException({
        fields: { rejectionReason: 'ต้องระบุเหตุผลที่ไม่ผ่าน' },
      });
    }

    const rows = await this.db
      .update(riderDocuments)
      .set({
        verified: input.approve,
        rejectionReason: input.approve ? null : input.rejectionReason!.trim(),
      })
      .where(and(eq(riderDocuments.accountId, accountId), eq(riderDocuments.kind, kind)))
      .returning({ id: riderDocuments.id });

    if (rows.length === 0) {
      throw new NotFoundException({ message: 'ยังไม่ได้ส่งเอกสารชนิดนี้' });
    }
    return (await this.documents(accountId)).find((d) => d.kind === kind)!;
  }

  async jobs(accountId: string): Promise<RiderJob[]> {
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.riderId, accountId), inArray(orders.status, ACTIVE_JOB_STATUSES as never)))
      .orderBy(orders.createdAt);

    const jobs = await Promise.all(rows.map((r) => this.jobDetail(r.id)));
    return jobs.filter((j): j is RiderJob => j !== null);
  }

  private async jobDetail(orderId: string): Promise<RiderJob | null> {
    const [row] = await this.db
      .select({
        order: orders,
        shopName: restaurants.name,
        shopAddress: restaurants.addressText,
        shopLocation: restaurants.location,
        shopPrepTimeMinutes: restaurants.prepTimeMinutes,
        dropAddress: addresses.addressText,
        dropNote: addresses.note,
        dropLocation: addresses.location,
      })
      .from(orders)
      .innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .innerJoin(addresses, eq(addresses.id, orders.deliveryAddressId))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!row) return null;

    /** ของในถุง (design R10) ไรเดอร์คือคนสุดท้ายที่ตรวจได้ก่อนอาหารออกจากร้าน */
    const itemRows = await this.db
      .select({
        name: orderItems.name,
        quantity: orderItems.quantity,
        note: orderItems.note,
        selectedChoices: orderItems.selectedChoices,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const items = itemRows.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      note: i.note,
      choiceNames: (i.selectedChoices as { name: string }[]).map((c) => c.name),
    }));

    const o = row.order;
    return {
      orderId: o.id,
      reference: o.reference,
      status: o.status as RiderJob['status'],
      restaurantName: row.shopName,
      restaurantAddress: row.shopAddress,
      restaurantLat: row.shopLocation.y,
      restaurantLng: row.shopLocation.x,
      dropoffAddress: row.dropAddress,
      dropoffNote: row.dropNote,
      dropoffLat: row.dropLocation.y,
      dropoffLng: row.dropLocation.x,
      // §6.3 จอ R10 ใช้สองค่านี้บอกว่าอีกกี่นาทีอาหารเสร็จ ไรเดอร์จะได้ไม่ไปยืนรอฟรี
      prepTimeMinutes: row.shopPrepTimeMinutes,
      acceptedAt: o.acceptedAt?.toISOString() ?? null,
      items,
      riderPaySatang: o.deliveryFeeSatang,
      /** ต้องเก็บเงินเฉพาะใบที่ยังไม่จ่าย ลูกค้าที่เปลี่ยนไปจ่ายพร้อมเพย์กลางทาง (§6.5) */
      collectCashSatang:
        o.paymentMethod === 'cash' && o.paymentStatus === 'pending'
          ? o.foodTotalSatang + o.deliveryFeeSatang + o.serviceFeeSatang
          : 0,
      leaveAtDoor: o.leaveAtDoor,
    };
  }

  /** รายได้ + ประวัติงานที่ส่งสำเร็จ (design R4 R6) */
  async earnings(accountId: string, period: EarningsPeriod = 'week') {
    const since = periodStart(period, new Date());
    const stats = await this.ordersPerHour(accountId, periodDays(period));

    const rows = await this.db
      .select({
        orderId: orders.id,
        reference: orders.reference,
        restaurantName: restaurants.name,
        dropoffAddress: addresses.addressText,
        deliveredAt: orders.deliveredAt,
        riderPaySatang: orders.deliveryFeeSatang,
        paymentMethod: orders.paymentMethod,
        /** ระยะเส้นตรงร้าน→ปลายทาง ::geography ทำให้ st_distance คืนเมตรบนทรงกลม */
        distanceKm: sql<number>`round((
          st_distance(${restaurants.location}::geography, ${addresses.location}::geography) / 1000.0
        )::numeric, 1)::float8`,
        /** ยังไม่มี picked_up_at (ข้อมูลเก่าก่อนมีคอลัมน์นี้) = ยังบอกไม่ได้ ไม่ใช่ศูนย์ */
        durationMinutes: sql<number | null>`case when ${orders.pickedUpAt} is null then null else
          greatest(0, round(extract(epoch from (${orders.deliveredAt} - ${orders.pickedUpAt})) / 60.0))::int
        end`,
      })
      .from(orders)
      .innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .innerJoin(addresses, eq(addresses.id, orders.deliveryAddressId))
      .where(
        and(
          eq(orders.riderId, accountId),
          eq(orders.status, 'delivered'),
          sql`${orders.deliveredAt} >= ${since.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(desc(orders.deliveredAt));

    const deliveries = rows.map((r) => ({
      orderId: r.orderId,
      reference: r.reference,
      restaurantName: r.restaurantName,
      dropoffAddress: r.dropoffAddress,
      // ผ่านด่าน status = 'delivered' มาแล้ว deliveredAt จึงมีค่าเสมอ
      deliveredAt: r.deliveredAt!.toISOString(),
      riderPaySatang: r.riderPaySatang,
      paymentMethod: r.paymentMethod,
      distanceKm: Number(r.distanceKm),
      durationMinutes: r.durationMinutes ?? 0,
    }));

    return {
      ...stats,
      period,
      totalPaySatang: deliveries.reduce((sum, d) => sum + d.riderPaySatang, 0),
      distanceKm: Number(deliveries.reduce((sum, d) => sum + d.distanceKm, 0).toFixed(1)),
      deliveries,
    };
  }

  /** §8 Orders per Rider Hour ของไรเดอร์คนนี้ ตัวเลขที่โมเดลทั้งหมดวัดตัวเองด้วย */
  async ordersPerHour(accountId: string, sinceDays = 7) {
    const [row] = await this.db.execute<{ hours: number; delivered: number }>(sql`
      select
        coalesce(sum(extract(epoch from (coalesce(offline_at, now()) - online_at)))/3600.0, 0)::float8 as hours,
        (select count(*) from orders o
           where o.rider_id = ${accountId}
             and o.status = 'delivered'
             and o.delivered_at > now() - (${sinceDays} || ' days')::interval)::int as delivered
      from rider_sessions
      where account_id = ${accountId} and online_at > now() - (${sinceDays} || ' days')::interval
    `);

    const hours = row?.hours ?? 0;
    return {
      hours: Number(hours.toFixed(2)),
      delivered: row?.delivered ?? 0,
      // ยังไม่เคยออนไลน์ = ยังไม่มีค่านี้ ไม่ใช่ 0 (0 อ่านเหมือน "ทำได้แย่")
      ordersPerHour: hours > 0 ? Number(((row?.delivered ?? 0) / hours).toFixed(2)) : null,
    };
  }
}
