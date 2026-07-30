import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { and, eq, inArray, asc, desc, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import {
  orders, orderItems, restaurants, menuItems, addresses, accounts, ledgerEntries,
  riderProfiles, riderStatus,
} from '../db/schema';
import { assertTransition, isActiveStatus, type OrderStatus } from './stateMachine';
import { assertCanSetStatus, type Actor } from './authorize';
import { isAdmin } from '../auth/roles';
import { effectiveIsOpen, parseWeeklyHours } from '../merchant/openingHours';
import { PlatformService, gateOfPaymentMethod } from '../platform/platform.service';
import { postOrderDelivered } from '../ledger/postOrder';
import { postTip } from '../ledger/postTip';
import { MAX_DELIVERY_RADIUS_KM, isWithinDeliveryRadius } from './deliveryRadius';
import { generateDeliveryPin } from './deliveryPin';
import { assertDeliveryProof } from './deliveryProof';
import { assertCanTip } from './tipping';
import { priceOrder, paymentFeeOf, orderReference, type PricedItem } from './pricing';
import type { CreateOrderInput, CreateAddressInput, CancelReason } from './dto';

/** รูปร่างเดียวกับ Order ในแอปมือถือ เพื่อให้สลับจากรีโปจำลองมาใช้ของจริงได้โดยไม่แก้จอ */
export type PublicOrder = {
  id: string;
  reference: string;
  customerId: string;
  restaurantId: string;
  riderId?: string;
  status: OrderStatus;
  items: {
    menuItemId: string; name: string; unitPrice: number; quantity: number;
    /** ข้อความที่ลูกค้าฝากถึงร้านสำหรับจานนี้ */
    note?: string;
    /** ตัวเลือกที่เลือกไว้ id ไว้ประกอบตะกร้าใหม่ตอนสั่งซ้ำ (C33) ชื่อไว้แสดงผล */
    choiceIds: string[];
    choiceNames: string[];
  }[];
  foodTotal: number;
  deliveryFee: number;
  serviceFee: number;
  paymentMethod: 'promptpay' | 'cash' | 'card';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
  /** พิกัดสามจุดของจอติดตาม (design C6) */
  restaurantLat: number | null;
  restaurantLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  /** ตำแหน่งไรเดอร์ null = ยังไม่มีไรเดอร์ ยังไม่เคยส่งพิกัด หรืองานจบไปแล้ว */
  riderLocation: { lat: number; lng: number } | null;
  /** รหัสยืนยันส่งสี่หลัก (design R11) มีเฉพาะตอนลูกค้าเจ้าของออร์เดอร์เป็นคนถาม */
  deliveryPin?: string;
  /** ลูกค้าขอให้วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
  leaveAtDoor: boolean;
  /** ทิปที่ให้ไรเดอร์ไปแล้ว (design C11) 0 = ยังไม่ให้ ซึ่งจอใช้ตัดสินว่าจะโชว์ปุ่มไหม */
  tipSatang: number;
  /** ใครยกเลิกและเพราะอะไร (design M12) `null` เมื่อออร์เดอร์ยังไม่ถูกยกเลิก */
  cancelledBy: 'customer' | 'restaurant' | 'admin' | null;
  cancelReason: 'out_of_stock' | 'too_busy' | 'closing_soon' | 'other' | null;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly platform: PlatformService,
  ) {}

  async create(customerId: string, input: CreateOrderInput): Promise<PublicOrder> {
    const [restaurant] = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, input.restaurantId))
      .limit(1);

    if (!restaurant) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    if (!restaurant.isApproved) throw new BadRequestException({ message: 'ร้านนี้ยังไม่เปิดให้บริการ' });
    /** ตัดสินด้วยฟังก์ชันเดียวกับที่ catalog ใช้บอกลูกค้าว่าร้านเปิด (design M11) */
    if (
      !effectiveIsOpen({
        isOpen: restaurant.isOpen,
        isApproved: restaurant.isApproved,
        hours: parseWeeklyHours(restaurant.openingHours),
        pausedUntil: restaurant.pausedUntil,
        at: new Date(),
      })
    ) {
      throw new BadRequestException({ message: 'ร้านปิดอยู่' });
    }

    /** feature flag ต้องกั้นที่ เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนตัวเลือกในแอป (design SA4) */
    const gate = gateOfPaymentMethod(input.paymentMethod);
    if (gate && !(await this.platform.isEnabled(gate.flag))) {
      throw new BadRequestException({
        message: `ตอนนี้ปิดรับ${gate.label}ชั่วคราว กรุณาเลือกพร้อมเพย์`,
        fields: { paymentMethod: 'ยังไม่เปิดให้ใช้' },
      });
    }

    /** product-spec §4.3 ห้ามสั่งอาหารจากร้านของตัวเอง ต้องเช็คที่เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่มในแอป */
    if (restaurant.ownerUserId === customerId) {
      throw new ForbiddenException({ message: 'สั่งอาหารจากร้านของตัวเองไม่ได้' });
    }

    const address = await this.resolveAddress(customerId, input.deliveryAddressId);

    /** ด่านจริงของโมเดล: ระยะจากร้านถึงปลายทางต้องไม่เกิน MAX_DELIVERY_RADIUS_KM */
    const [d] = await this.db.execute<{ km: number }>(sql`
      select st_distance(r.location::geography, a.location::geography) / 1000.0 as km
        from restaurants r, addresses a
       where r.id = ${input.restaurantId} and a.id = ${address.id}
    `);

    const distanceKm = Number(d?.km ?? Number.NaN);
    if (!isWithinDeliveryRadius(distanceKm)) {
      throw new BadRequestException({
        message: `ร้านนี้อยู่ห่างเกิน ${MAX_DELIVERY_RADIUS_KM} กม. จากที่อยู่จัดส่ง`,
        fields: { deliveryAddressId: 'เลือกที่อยู่ที่ใกล้ร้านกว่านี้ หรือเลือกร้านที่ใกล้กว่า' },
      });
    }

    const priced = await this.priceItems(input.restaurantId, input.items);
    /** ราคาอ่านจาก `platform_pricing` ทุกครั้งที่สร้างออร์เดอร์ (design SA6) */
    const config = await this.platform.pricing();
    const pricing = priceOrder(priced, distanceKm, config);

    const created = await this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          reference: orderReference(),
          customerId,
          restaurantId: input.restaurantId,
          zoneId: restaurant.zoneId,
          deliveryAddressId: address.id,
          foodTotalSatang: pricing.foodTotalSatang,
          deliveryFeeSatang: pricing.deliveryFeeSatang,
          serviceFeeSatang: pricing.serviceFeeSatang,
          commissionSatang: pricing.commissionSatang,
          commissionRateBp: config.commissionRateBp,
          paymentMethod: input.paymentMethod,
          // เงินสดยังไม่ได้จ่าย ไรเดอร์เก็บตอนส่ง ช่องทางอื่นจ่ายจบก่อนออร์เดอร์เริ่มเดิน
          paymentStatus: input.paymentMethod === 'cash' ? 'pending' : 'paid',
          paidAt: input.paymentMethod === 'cash' ? null : new Date(),
          // §6.3 ใช้ค่าที่ร้านตั้งเองเป็นตัวตั้งต้น จนกว่าจะมีข้อมูลย้อนหลังพอทำค่าเฉลี่ยเคลื่อนที่
          predictedReadyAt: new Date(Date.now() + restaurant.prepTimeMinutes * 60_000),
          // R11 สุ่มตั้งแต่สร้างออร์เดอร์ เพราะลูกค้าต้องเห็นได้ตลอดจากจอติดตาม
          deliveryPin: generateDeliveryPin(),
          leaveAtDoor: input.leaveAtDoor,
        })
        .returning();

      await tx.insert(orderItems).values(
        priced.map((i) => ({
          orderId: order!.id,
          menuItemId: i.menuItemId,
          name: i.name,
          unitPriceSatang: i.unitPriceSatang,
          quantity: i.quantity,
          selectedChoices: i.selectedChoices,
          note: i.note ?? null,
        })),
      );

      return order!;
    });

    return this.publicOrder(created.id, true);
  }

  /** ตีราคาจากเมนูในฐาน ไม่ใช่จากราคาที่แอปส่งมา */
  private async priceItems(
    restaurantId: string,
    items: CreateOrderInput['items'],
  ): Promise<PricedItem[]> {
    const ids = [...new Set(items.map((i) => i.menuItemId))];
    const rows = await this.db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.restaurantId, restaurantId), inArray(menuItems.id, ids)));

    const byId = new Map(rows.map((r) => [r.id, r]));

    return items.map((i) => {
      const menu = byId.get(i.menuItemId);
      // เมนูไม่อยู่ในร้านนี้ = แอปส่งข้อมูลผิด หรือมีคนพยายามผสมเมนูข้ามร้าน
      if (!menu) throw new BadRequestException({ message: 'มีรายการที่ไม่อยู่ในเมนูของร้านนี้' });
      if (!menu.isAvailable) {
        throw new ConflictException({ message: `"${menu.name}" หมดแล้ว กรุณาเอาออกจากตะกร้า` });
      }

      const groups = (menu.optionGroups ?? []) as {
        id: string;
        name: string;
        minSelect: number;
        maxSelect: number;
        choices: { id: string; name: string; priceDelta: number }[];
      }[];

      const chosen: PricedItem['selectedChoices'] = [];
      for (const group of groups) {
        const picked = group.choices.filter((c) => i.choiceIds.includes(c.id));
        if (picked.length < group.minSelect || picked.length > group.maxSelect) {
          throw new BadRequestException({
            message: `"${menu.name}" ต้องเลือก "${group.name}" ให้ครบตามที่ร้านกำหนด`,
          });
        }
        chosen.push(...picked);
      }

      return {
        menuItemId: menu.id,
        // แช่แข็งชื่อไว้ตอนสั่ง ร้านแก้ชื่อเมนูวันหลังแล้วใบเสร็จเก่าต้องไม่เปลี่ยนตาม
        name: chosen.length ? `${menu.name} (${chosen.map((c) => c.name).join(', ')})` : menu.name,
        unitPriceSatang: menu.priceSatang + chosen.reduce((s, c) => s + c.priceDelta, 0),
        quantity: i.quantity,
        // ข้อความจากลูกค้าผ่านมาตรง ๆ ไม่มีผลกับราคา เซิร์ฟเวอร์ยังคิดเงินเองเหมือนเดิม
        ...(i.note ? { note: i.note } : {}),
        selectedChoices: chosen,
      };
    });
  }

  /** ไม่ระบุมา = ใช้ที่อยู่แรกที่บันทึกไว้ ถ้ายังไม่มีเลยต้องบอกให้ชัดว่าต้องเพิ่มก่อน */
  private async resolveAddress(customerId: string, addressId?: string) {
    if (addressId) {
      const [row] = await this.db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, addressId), eq(addresses.accountId, customerId)))
        .limit(1);
      // เช็คว่าที่อยู่เป็นของคนสั่งจริง ไม่งั้นส่งของไปที่บ้านคนอื่นได้ด้วยการเดา id
      if (!row) throw new NotFoundException({ message: 'ไม่พบที่อยู่นี้' });
      return row;
    }

    const [fallback] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.accountId, customerId))
      .orderBy(asc(addresses.createdAt))
      .limit(1);

    if (!fallback) {
      throw new BadRequestException({
        message: 'ต้องเพิ่มที่อยู่จัดส่งก่อนสั่งอาหาร',
        fields: { deliveryAddressId: 'ยังไม่มีที่อยู่' },
      });
    }
    return fallback;
  }

  async listForCustomer(customerId: string): Promise<PublicOrder[]> {
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
    return Promise.all(rows.map((r) => this.publicOrder(r.id, true)));
  }

  /** ความสัมพันธ์ของบัญชีนี้กับออร์เดอร์ใบนั้น ใช้ตัดสินทั้งการอ่านและการเปลี่ยนสถานะ */
  private async actorFor(
    order: { customerId: string; restaurantId: string; riderId: string | null },
    accountId: string,
  ): Promise<Actor> {
    const [me] = await this.db
      .select({ accountType: accounts.accountType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (me && isAdmin(me.accountType)) return 'admin';
    if (order.riderId === accountId) return 'rider';
    if (order.customerId === accountId) return 'customer';

    const [shop] = await this.db
      .select({ ownerUserId: restaurants.ownerUserId })
      .from(restaurants)
      .where(eq(restaurants.id, order.restaurantId))
      .limit(1);

    return shop?.ownerUserId === accountId ? 'restaurantOwner' : 'stranger';
  }

  async getForAccount(orderId: string, accountId: string): Promise<PublicOrder> {
    const order = await this.publicOrder(orderId);
    const actor = await this.actorFor(
      { customerId: order.customerId, restaurantId: order.restaurantId, riderId: order.riderId ?? null },
      accountId,
    );
    // ตอบ 404 ไม่ใช่ 403 403 เป็นการยืนยันว่าออร์เดอร์รหัสนี้มีอยู่จริง
    if (actor === 'stranger') throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
    // เฉพาะลูกค้าเจ้าของเท่านั้นที่เห็นรหัสยืนยันส่ง ไรเดอร์ต้องถามเอาจากลูกค้า
    return actor === 'customer' ? this.publicOrder(orderId, true) : order;
  }

  /** เปลี่ยนสถานะ และถ้าถึง delivered ให้ลง ledger ในทรานแซกชันเดียวกัน */
  /** เปลี่ยนสถานะออร์เดอร์ */
  async updateStatus(
    orderId: string,
    next: OrderStatus,
    accountId: string,
    proof?: { deliveryPin?: string; photoPath?: string },
    /** เหตุผลที่ปฏิเสธ (design M12) บังคับเมื่อ ร้าน เป็นคนยกเลิก */
    cancel?: { reason?: CancelReason },
  ): Promise<PublicOrder> {
    await this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
      if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });

      const actor = await this.actorFor(order, accountId);
      // คนนอกไม่ควรรู้ด้วยซ้ำว่าออร์เดอร์นี้มีอยู่
      if (actor === 'stranger') throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
      assertCanSetStatus(actor, next);

      assertTransition(order.status, next);

      if (next === 'delivered' && actor === 'rider') {
        /** บังคับซ้ำที่นี่เสมอ ไม่เชื่อว่าแอปบังคับไปแล้ว จอ R11 ซ่อนช่อง PIN ให้ใบที่ */
        assertDeliveryProof({
          leaveAtDoor: order.leaveAtDoor,
          expectedPin: order.deliveryPin,
          given: { deliveryPin: proof?.deliveryPin, photoPath: proof?.photoPath },
        });
      }

      /** ร้านที่ปฏิเสธใบต้องบอกเหตุผลเสมอ (design M12) */
      if (next === 'cancelled' && actor === 'restaurantOwner' && !cancel?.reason) {
        throw new BadRequestException({
          message: 'ต้องเลือกเหตุผลที่ปฏิเสธออร์เดอร์',
          fields: { reason: 'กรุณาเลือกเหตุผล' },
        });
      }

      const cancelledByActor =
        actor === 'restaurantOwner' ? 'restaurant' : actor === 'admin' ? 'admin' : 'customer';

      const now = new Date();
      const stamps: Record<string, Date> = {
        accepted: now,
        picked_up: now,
        delivered: now,
        cancelled: now,
      };
      await tx
        .update(orders)
        .set({
          status: next,
          ...(next === 'accepted' ? { acceptedAt: stamps.accepted } : {}),
          ...(next === 'picked_up' ? { pickedUpAt: stamps.picked_up } : {}),
          ...(next === 'delivered' ? { deliveredAt: stamps.delivered } : {}),
          ...(next === 'delivered' && proof?.photoPath
            ? { deliveryPhotoPath: proof.photoPath }
            : {}),
          ...(next === 'cancelled'
            ? {
                cancelledAt: stamps.cancelled,
                cancelledBy: cancelledByActor,
                cancelReason: cancel?.reason ?? null,
              }
            : {}),
        })
        .where(eq(orders.id, orderId));

      /** งานของไรเดอร์จบแล้ว (ส่งถึงหรือถูกยกเลิก) บันทึกเวลาไว้ให้พจน์ fairness */
      if (order.riderId && (next === 'delivered' || next === 'cancelled')) {
        await tx
          .update(riderStatus)
          .set({ lastJobEndedAt: now })
          .where(eq(riderStatus.accountId, order.riderId));
      }

      /** ยกเลิกใบที่ลูกค้าจ่ายมาแล้ว (พร้อมเพย์จ่ายล่วงหน้า) ต้องคืนเงิน */
      if (next === 'cancelled' && order.paymentStatus === 'paid') {
        await tx
          .update(orders)
          .set({ paymentStatus: 'refunded' })
          .where(eq(orders.id, orderId));
      }

      if (next !== 'delivered') return;

      const gross = order.foodTotalSatang + order.deliveryFeeSatang + order.serviceFeeSatang;

      /** ส่งถึงแล้วถือว่าเก็บเงินสดครบ (§6.5 เลยจุดนี้ปัญหาไปทางกระบวนการคืนเงิน) */
      if (order.paymentMethod === 'cash' && order.paymentStatus === 'pending') {
        await tx
          .update(orders)
          .set({ paymentStatus: 'paid', paidAt: now })
          .where(eq(orders.id, orderId));

        if (order.riderId) {
          await tx
            .update(riderProfiles)
            .set({ cashHeldSatang: sql`${riderProfiles.cashHeldSatang} + ${gross}` })
            .where(eq(riderProfiles.accountId, order.riderId));
        }
      }
      const lines = postOrderDelivered({
        foodTotalSatang: order.foodTotalSatang,
        deliveryFeeSatang: order.deliveryFeeSatang,
        serviceFeeSatang: order.serviceFeeSatang,
        /** ยังไม่มีระบบจ่ายงานไรเดอร์ (คลื่นที่ 4) ออร์เดอร์ที่ไม่มีไรเดอร์จึงจ่ายไรเดอร์ 0 */
        riderPaySatang: order.riderId ? order.deliveryFeeSatang : 0,
        paymentFeeSatang: paymentFeeOf(order.paymentMethod, gross),
        method: order.paymentMethod,
        // อัตราที่ใบนี้ใช้ตอนสร้าง ไม่ใช่อัตราปัจจุบัน ซูเปอร์แอดมินเปลี่ยนคอมแล้ว
        commissionRateBp: order.commissionRateBp,
      });

      const entryGroupId = randomUUID();
      await tx.insert(ledgerEntries).values(
        lines.map((l) => ({
          entryGroupId,
          account: l.account,
          debitSatang: l.debitSatang,
          creditSatang: l.creditSatang,
          orderId: order.id,
          counterpartyAccountId: l.account === 'rider_payable' ? order.riderId : null,
          // ต้องติดร้านไปกับแถวนี้ ไม่งั้นรอบจ่ายร้าน (AD7) แยกไม่ออกว่าเงินก้อนไหนของใคร
          restaurantId: l.account === 'restaurant_payable' ? order.restaurantId : null,
          reason: 'order.delivered',
        })),
      );
    });

    return this.publicOrder(orderId);
  }

  /** ลูกค้าสั่งเงินสดไว้แล้วเงินไม่พอ จ่ายพร้อมเพย์เข้าแพลตฟอร์มโดยตรง (product-spec §6.5) */
  async payWithPromptPay(orderId: string, customerId: string): Promise<PublicOrder> {
    await this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
      if (!order || order.customerId !== customerId) {
        throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
      }

      // กติกาเดียวกับ canPayNowWithPromptPay ฝั่งแอป ต้องตรวจซ้ำที่นี่ ไม่เชื่อว่าจอซ่อนปุ่มไว้แล้ว
      const changeable =
        order.paymentMethod === 'cash' &&
        order.paymentStatus === 'pending' &&
        isActiveStatus(order.status);

      if (!changeable) {
        throw new ConflictException({ message: 'เปลี่ยนวิธีชำระเงินของออร์เดอร์นี้ไม่ได้แล้ว' });
      }

      await tx
        .update(orders)
        .set({ paymentMethod: 'promptpay', paymentStatus: 'paid', paidAt: new Date() })
        .where(eq(orders.id, orderId));
    });

    return this.publicOrder(orderId);
  }

  /** ลูกค้าให้ทิปไรเดอร์หลังส่งถึงแล้ว (design C11) เข้าไรเดอร์ 100% ไม่หักคอม */
  async tip(orderId: string, customerId: string, amountSatang: number): Promise<PublicOrder> {
    await this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
      // ตอบ 404 ไม่ใช่ 403 ให้คนที่ไม่ใช่เจ้าของ ไม่ยืนยันว่าออร์เดอร์รหัสนี้มีอยู่จริง
      if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });

      assertCanTip({
        viewerId: customerId,
        order: {
          customerId: order.customerId,
          riderId: order.riderId,
          status: order.status,
          tipSatang: order.tipSatang,
        },
        amountSatang,
      });

      await tx.update(orders).set({ tipSatang: amountSatang }).where(eq(orders.id, orderId));

      const entryGroupId = randomUUID();
      await tx.insert(ledgerEntries).values(
        postTip({ amountSatang }).map((l) => ({
          entryGroupId,
          orderId,
          account: l.account,
          debitSatang: l.debitSatang,
          creditSatang: l.creditSatang,
          // ผูกกับไรเดอร์ เพื่อให้ยอดค้างจ่ายของเขา (`balance()`) รวมทิปเข้าไปเอง
          counterpartyAccountId: order.riderId,
          reason: 'order.tip',
        })),
      );
    });

    return this.publicOrder(orderId);
  }

  /** ข้อมูลออร์เดอร์ที่ส่งออกไปให้ผู้ใช้ */
  private async publicOrder(orderId: string, includePin = false): Promise<PublicOrder> {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });

    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.name));

    /** พิกัดสามจุดสำหรับจอติดตาม (design C6) ร้าน ปลายทาง ไรเดอร์ */
    const [places] = await this.db
      .select({
        restaurantLocation: restaurants.location,
        dropoffLocation: addresses.location,
        riderLocation: riderStatus.location,
      })
      .from(orders)
      .innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .innerJoin(addresses, eq(addresses.id, orders.deliveryAddressId))
      .leftJoin(riderStatus, eq(riderStatus.accountId, orders.riderId))
      .where(eq(orders.id, orderId))
      .limit(1);

    const stillRunning = isActiveStatus(order.status as OrderStatus);
    const rider = stillRunning ? places?.riderLocation ?? null : null;

    return {
      restaurantLat: places?.restaurantLocation.y ?? null,
      restaurantLng: places?.restaurantLocation.x ?? null,
      dropoffLat: places?.dropoffLocation.y ?? null,
      dropoffLng: places?.dropoffLocation.x ?? null,
      riderLocation: rider ? { lat: rider.y, lng: rider.x } : null,
      id: order.id,
      reference: order.reference,
      customerId: order.customerId,
      restaurantId: order.restaurantId,
      ...(order.riderId ? { riderId: order.riderId } : {}),
      status: order.status,
      items: items.map((i) => ({
        menuItemId: i.menuItemId ?? '',
        name: i.name,
        unitPrice: i.unitPriceSatang,
        quantity: i.quantity,
        ...(i.note ? { note: i.note } : {}),
        /** ทั้ง id และชื่อของตัวเลือกที่เลือกไว้ (design C33 "สั่งซ้ำ") */
        choiceIds: (i.selectedChoices as { id: string }[]).map((c) => c.id),
        choiceNames: (i.selectedChoices as { name: string }[]).map((c) => c.name),
      })),
      foodTotal: order.foodTotalSatang,
      deliveryFee: order.deliveryFeeSatang,
      serviceFee: order.serviceFeeSatang,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
      leaveAtDoor: order.leaveAtDoor,
      tipSatang: order.tipSatang,
      cancelledBy: order.cancelledBy,
      cancelReason: order.cancelReason,
      ...(includePin ? { deliveryPin: order.deliveryPin } : {}),
    };
  }

  /** product-spec §7 ที่อยู่ต้องมีพิกัด เพราะระยะทางกับการจ่ายงานคิดจากพิกัด ไม่ใช่ข้อความ */
  async addAddress(accountId: string, input: CreateAddressInput) {
    const [row] = await this.db
      .insert(addresses)
      .values({
        accountId,
        label: input.label,
        addressText: input.addressText,
        note: input.note ?? null,
        // PostGIS เรียง (x, y) = (lng, lat) ซึ่งสลับกับที่คนพูดกันว่า "lat, lng"
        location: { x: input.lng, y: input.lat },
      })
      .returning();
    return this.toPublicAddress(row!);
  }

  async listAddresses(accountId: string) {
    const rows = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.accountId, accountId))
      .orderBy(asc(addresses.createdAt));
    return rows.map((r) => this.toPublicAddress(r));
  }

  private toPublicAddress(r: typeof addresses.$inferSelect) {
    return {
      id: r.id,
      label: r.label,
      addressText: r.addressText,
      note: r.note ?? undefined,
      lat: r.location.y,
      lng: r.location.x,
    };
  }
}
