import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { and, eq, inArray, asc, desc } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { orders, orderItems, restaurants, menuItems, addresses, accounts, ledgerEntries } from '../db/schema';
import { assertTransition, isActiveStatus, type OrderStatus } from './stateMachine';
import { assertCanSetStatus, type Actor } from './authorize';
import { postOrderDelivered } from '../ledger/postOrder';
import { priceOrder, paymentFeeOf, orderReference, type PricedItem } from './pricing';
import type { CreateOrderInput, CreateAddressInput } from './dto';

/** รูปร่างเดียวกับ Order ในแอปมือถือ เพื่อให้สลับจากรีโปจำลองมาใช้ของจริงได้โดยไม่แก้จอ */
export type PublicOrder = {
  id: string;
  reference: string;
  customerId: string;
  restaurantId: string;
  riderId?: string;
  status: OrderStatus;
  items: { menuItemId: string; name: string; unitPrice: number; quantity: number }[];
  foodTotal: number;
  deliveryFee: number;
  serviceFee: number;
  paymentMethod: 'promptpay' | 'cash' | 'card';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
};

@Injectable()
export class OrdersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(customerId: string, input: CreateOrderInput): Promise<PublicOrder> {
    const [restaurant] = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, input.restaurantId))
      .limit(1);

    if (!restaurant) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    if (!restaurant.isApproved) throw new BadRequestException({ message: 'ร้านนี้ยังไม่เปิดให้บริการ' });
    if (!restaurant.isOpen) throw new BadRequestException({ message: 'ร้านปิดอยู่' });

    /**
     * claude.md §4.3 — ห้ามสั่งอาหารจากร้านของตัวเอง ต้องเช็คที่เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่มในแอป
     * ฐานข้อมูลมี trigger กันไว้อีกชั้น แต่ตรงนี้ให้ข้อความที่อ่านรู้เรื่องกว่า error ของ Postgres
     */
    if (restaurant.ownerUserId === customerId) {
      throw new ForbiddenException({ message: 'สั่งอาหารจากร้านของตัวเองไม่ได้' });
    }

    const address = await this.resolveAddress(customerId, input.deliveryAddressId);

    const priced = await this.priceItems(input.restaurantId, input.items);
    const pricing = priceOrder(priced);

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
          paymentMethod: input.paymentMethod,
          // เงินสดยังไม่ได้จ่าย ไรเดอร์เก็บตอนส่ง — ช่องทางอื่นจ่ายจบก่อนออร์เดอร์เริ่มเดิน
          paymentStatus: input.paymentMethod === 'cash' ? 'pending' : 'paid',
          paidAt: input.paymentMethod === 'cash' ? null : new Date(),
          // §6.3 ใช้ค่าที่ร้านตั้งเองเป็นตัวตั้งต้น จนกว่าจะมีข้อมูลย้อนหลังพอทำค่าเฉลี่ยเคลื่อนที่
          predictedReadyAt: new Date(Date.now() + restaurant.prepTimeMinutes * 60_000),
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
        })),
      );

      return order!;
    });

    return this.publicOrder(created.id);
  }

  /**
   * ตีราคาจากเมนูในฐาน **ไม่ใช่จากราคาที่แอปส่งมา**
   *
   * ถ้าเชื่อราคาจากแอป คนที่แก้แอปเองจะสั่งข้าว ฿500 ในราคา ฿1 ได้ และคอมมิชชัน 15%
   * ก็จะคิดจากยอดปลอมนั้น — ร้านเสียเงินจริงจากตัวเลขที่ลูกค้ากรอกเอง
   */
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
    return Promise.all(rows.map((r) => this.publicOrder(r.id)));
  }

  /**
   * ความสัมพันธ์ของบัญชีนี้กับออร์เดอร์ใบนั้น — ใช้ตัดสินทั้งการอ่านและการเปลี่ยนสถานะ
   * อ่านจากฐานทุกครั้ง ไม่เชื่อสิ่งที่ client ส่งมาบอกว่าตัวเองเป็นใคร
   */
  private async actorFor(
    order: { customerId: string; restaurantId: string; riderId: string | null },
    accountId: string,
  ): Promise<Actor> {
    const [me] = await this.db
      .select({ accountType: accounts.accountType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (me?.accountType === 'admin') return 'admin';
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
    // ตอบ 404 ไม่ใช่ 403 — 403 เป็นการยืนยันว่าออร์เดอร์รหัสนี้มีอยู่จริง
    if (actor === 'stranger') throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
    return order;
  }

  /**
   * เปลี่ยนสถานะ และถ้าถึง delivered ให้ลง ledger **ในทรานแซกชันเดียวกัน**
   * (claude.md §5 กติกาข้อ 2 — ไม่มีข้อยกเว้น ไม่มี "เดี๋ยวค่อยกระทบยอด")
   *
   * ต้องรู้ว่าใครสั่ง เพราะ `delivered` เขียนรายการบัญชีจริง — ปล่อยให้ใครก็กดได้
   * เท่ากับเปิดให้สร้างรายการบัญชีของออร์เดอร์คนอื่น ดูกติกาที่ authorize.ts
   */
  async updateStatus(orderId: string, next: OrderStatus, accountId: string): Promise<PublicOrder> {
    await this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
      if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });

      const actor = await this.actorFor(order, accountId);
      // คนนอกไม่ควรรู้ด้วยซ้ำว่าออร์เดอร์นี้มีอยู่
      if (actor === 'stranger') throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
      assertCanSetStatus(actor, next);

      assertTransition(order.status, next);

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
          ...(next === 'cancelled' ? { cancelledAt: stamps.cancelled } : {}),
        })
        .where(eq(orders.id, orderId));

      if (next !== 'delivered') return;

      const gross = order.foodTotalSatang + order.deliveryFeeSatang + order.serviceFeeSatang;
      const lines = postOrderDelivered({
        foodTotalSatang: order.foodTotalSatang,
        deliveryFeeSatang: order.deliveryFeeSatang,
        serviceFeeSatang: order.serviceFeeSatang,
        /**
         * ยังไม่มีระบบจ่ายงานไรเดอร์ (คลื่นที่ 4) — ออร์เดอร์ที่ไม่มีไรเดอร์จึงจ่ายไรเดอร์ 0
         * ค่าส่งที่เก็บมาจะไปอยู่ในรายได้แพลตฟอร์มทั้งก้อน ซึ่งถูกต้องตามความจริง
         * เพราะเราเก็บค่าส่งแล้วไม่ได้จ่ายใคร — ไม่ใช่การซ่อนต้นทุน
         */
        riderPaySatang: order.riderId ? order.deliveryFeeSatang : 0,
        paymentFeeSatang: paymentFeeOf(order.paymentMethod, gross),
        method: order.paymentMethod,
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
          reason: 'order.delivered',
        })),
      );
    });

    return this.publicOrder(orderId);
  }

  /**
   * ลูกค้าสั่งเงินสดไว้แล้วเงินไม่พอ — จ่ายพร้อมเพย์เข้าแพลตฟอร์มโดยตรง (claude.md §6.5)
   * ไรเดอร์ไม่ต้องออกเงินและไม่ต้องรับโอนเข้าบัญชีส่วนตัว
   */
  async payWithPromptPay(orderId: string, customerId: string): Promise<PublicOrder> {
    await this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
      if (!order || order.customerId !== customerId) {
        throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
      }

      // กติกาเดียวกับ canPayNowWithPromptPay ฝั่งแอป — ต้องตรวจซ้ำที่นี่ ไม่เชื่อว่าจอซ่อนปุ่มไว้แล้ว
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

  private async publicOrder(orderId: string): Promise<PublicOrder> {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });

    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.name));

    return {
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
      })),
      foodTotal: order.foodTotalSatang,
      deliveryFee: order.deliveryFeeSatang,
      serviceFee: order.serviceFeeSatang,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
    };
  }

  /** claude.md §7 — ที่อยู่ต้องมีพิกัด เพราะระยะทางกับการจ่ายงานคิดจากพิกัด ไม่ใช่ข้อความ */
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
