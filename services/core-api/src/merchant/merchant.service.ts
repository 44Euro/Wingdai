import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, asc, desc } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { orders, orderItems, restaurants, menuItems, accounts } from '../db/schema';
import type { OrderStatus } from '../orders/stateMachine';
import type { CreateMenuItemInput, UpdateMenuItemInput } from './dto';

/**
 * สิ่งที่ครัวต้องเห็นเพื่อทำอาหารและตัดสินใจรับงาน — มากกว่าที่ลูกค้าเห็นในบางช่อง
 * และ **น้อยกว่า** ในบางช่องโดยตั้งใจ: ไม่มีเบอร์โทรลูกค้า เพราะร้านไม่ได้เป็นคนไปส่ง
 * ไรเดอร์ต่างหากที่ต้องติดต่อลูกค้า (§4.2) — เก็บข้อมูลส่วนบุคคลเท่าที่งานต้องใช้จริง
 */
export type MerchantOrder = {
  id: string;
  reference: string;
  restaurantId: string;
  restaurantName: string;
  status: OrderStatus;
  /** ชื่อลูกค้าไว้ขานตอนไรเดอร์มารับ ไม่ใช่ไว้ติดต่อ */
  customerName: string;
  items: { name: string; unitPrice: number; quantity: number }[];
  foodTotal: number;
  /** 15% ของค่าอาหาร ที่แช่แข็งไว้ตอนสั่ง (§6.1) — ไม่คำนวณสดตอนอ่าน */
  commission: number;
  /** สิ่งที่ร้านได้จริงจากใบนี้ = ค่าอาหาร − คอมมิชชัน (ไม่รวมค่าส่ง/ค่าบริการ ซึ่งไม่ใช่ของร้าน) */
  restaurantPayout: number;
  paymentMethod: 'promptpay' | 'cash' | 'card';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  hasRider: boolean;
  createdAt: string;
  acceptedAt: string | null;
};

export type MerchantRestaurant = {
  id: string;
  name: string;
  isApproved: boolean;
  isOpen: boolean;
  prepTimeMinutes: number;
};

/**
 * งานฝั่ง "คิว" ที่ครัวต้องทำต่อ vs. งานที่จบจากมือร้านไปแล้ว
 *
 * `picked_up` อยู่ฝั่งประวัติ เพราะไรเดอร์รับของไปแล้ว = ครัวไม่ต้องทำอะไรอีก
 * ถ้าปล่อยค้างในคิว รายการจะยาวขึ้นเรื่อย ๆ จนใบที่ต้องรีบจริงถูกกลบ
 */
const QUEUE_STATUSES: OrderStatus[] = ['created', 'accepted', 'preparing'];
const DONE_STATUSES: OrderStatus[] = ['picked_up', 'delivered', 'cancelled'];

@Injectable()
export class MerchantService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** ร้านทั้งหมดที่บัญชีนี้เป็นเจ้าของ — รวมร้านที่ยังรออนุมัติ เพื่อให้จอบอกสถานะได้ */
  async myRestaurants(accountId: string): Promise<MerchantRestaurant[]> {
    const rows = await this.db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        isApproved: restaurants.isApproved,
        isOpen: restaurants.isOpen,
        prepTimeMinutes: restaurants.prepTimeMinutes,
      })
      .from(restaurants)
      .where(eq(restaurants.ownerUserId, accountId))
      .orderBy(asc(restaurants.createdAt));
    return rows;
  }

  /**
   * ร้านนี้เป็นของบัญชีนี้จริงไหม
   *
   * ตอบ 404 ไม่ใช่ 403 เมื่อไม่ใช่เจ้าของ — 403 เป็นการยืนยันว่าร้าน id นี้มีอยู่จริง
   * ซึ่งเปิดให้ไล่เดา id เพื่อสำรวจว่าใครมีร้านบ้าง
   */
  private async assertOwns(accountId: string, restaurantId: string) {
    const [row] = await this.db
      .select()
      .from(restaurants)
      .where(and(eq(restaurants.id, restaurantId), eq(restaurants.ownerUserId, accountId)))
      .limit(1);
    if (!row) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    return row;
  }

  /**
   * ออร์เดอร์ของร้านที่บัญชีนี้เป็นเจ้าของ
   *
   * เรียงเก่าไปใหม่ในคิว — ใบที่รอนานที่สุดอยู่บนสุดเสมอ ไม่ใช่ให้ร้านเลือกใบที่ทำง่ายก่อน
   * (§8 อัตราการรับออร์เดอร์ > 95% วัดจากทุกใบ ไม่ใช่เฉพาะใบที่ร้านอยากรับ)
   */
  async listOrders(
    accountId: string,
    opts: { restaurantId?: string; scope: 'queue' | 'history' },
  ): Promise<MerchantOrder[]> {
    const mine = await this.myRestaurants(accountId);
    const allowed = opts.restaurantId
      ? mine.filter((r) => r.id === opts.restaurantId)
      : mine;
    // ขอดูร้านที่ไม่ใช่ของตัวเอง = ได้คิวว่าง ไม่ใช่ error ที่บอกว่าร้านนั้นมีอยู่
    if (allowed.length === 0) return [];

    const ids = allowed.map((r) => r.id);
    const queue = opts.scope === 'queue';

    const rows = await this.db
      .select({
        order: orders,
        restaurantName: restaurants.name,
        customerName: accounts.fullName,
      })
      .from(orders)
      .innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .innerJoin(accounts, eq(accounts.id, orders.customerId))
      .where(
        and(
          inArray(orders.restaurantId, ids),
          inArray(orders.status, queue ? QUEUE_STATUSES : DONE_STATUSES),
        ),
      )
      .orderBy(queue ? asc(orders.createdAt) : desc(orders.createdAt))
      .limit(queue ? 100 : 50);

    if (rows.length === 0) return [];

    /*
     * ดึงรายการอาหารของทุกใบในคิวด้วยคำสั่งเดียว
     * ถ้าวนเรียกทีละใบ คิวช่วงพีค 40 ใบ = 41 คำสั่ง ซึ่งจอที่ต้องรีเฟรชทุกไม่กี่วินาทีรับไม่ไหว
     */
    const items = await this.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, rows.map((r) => r.order.id)))
      .orderBy(asc(orderItems.name));

    const byOrder = new Map<string, MerchantOrder['items']>();
    for (const i of items) {
      const list = byOrder.get(i.orderId) ?? [];
      list.push({ name: i.name, unitPrice: i.unitPriceSatang, quantity: i.quantity });
      byOrder.set(i.orderId, list);
    }

    return rows.map(({ order, restaurantName, customerName }) => ({
      id: order.id,
      reference: order.reference,
      restaurantId: order.restaurantId,
      restaurantName,
      status: order.status,
      customerName,
      items: byOrder.get(order.id) ?? [],
      foodTotal: order.foodTotalSatang,
      commission: order.commissionSatang,
      restaurantPayout: order.foodTotalSatang - order.commissionSatang,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      // ร้านต้องรู้แค่ว่ามีคนมารับหรือยัง ไม่ต้องรู้ว่าไรเดอร์คนไหน
      hasRider: order.riderId !== null,
      createdAt: order.createdAt.toISOString(),
      acceptedAt: order.acceptedAt?.toISOString() ?? null,
    }));
  }

  /**
   * ร้านกดเปิด/ปิดรับออร์เดอร์เอง — ต่างจาก isApproved ที่แอดมินคุม
   * ร้านที่ยังไม่อนุมัติเปิดไม่ได้ ไม่งั้นจะรับออร์เดอร์ได้ทั้งที่ยังไม่ผ่านการตรวจ
   */
  async setOpen(accountId: string, restaurantId: string, isOpen: boolean): Promise<MerchantRestaurant> {
    const shop = await this.assertOwns(accountId, restaurantId);
    if (!shop.isApproved && isOpen) {
      throw new NotFoundException({ message: 'ร้านนี้ยังรออนุมัติ เปิดรับออร์เดอร์ไม่ได้' });
    }

    const [row] = await this.db
      .update(restaurants)
      .set({ isOpen })
      .where(eq(restaurants.id, restaurantId))
      .returning();

    return {
      id: row!.id,
      name: row!.name,
      isApproved: row!.isApproved,
      isOpen: row!.isOpen,
      prepTimeMinutes: row!.prepTimeMinutes,
    };
  }

  async createMenuItem(accountId: string, input: CreateMenuItemInput) {
    await this.assertOwns(accountId, input.restaurantId);
    const [row] = await this.db
      .insert(menuItems)
      .values({
        restaurantId: input.restaurantId,
        name: input.name,
        description: input.description ?? null,
        priceSatang: input.price,
        category: input.category,
        isAvailable: input.isAvailable,
        optionGroups: input.optionGroups ?? [],
      })
      .returning();
    return this.publicMenuItem(row!);
  }

  /**
   * แก้เมนู — ที่ใช้บ่อยที่สุดคือกด "ของหมด" ระหว่างวัน
   * ของหมดต้องปิดได้ทันที ไม่งั้นลูกค้าสั่งของที่ไม่มี แล้วจบที่การคืนเงิน (§6.4) ซึ่งนับเป็นความผิดร้าน
   */
  async updateMenuItem(accountId: string, menuItemId: string, patch: UpdateMenuItemInput) {
    const [existing] = await this.db
      .select({ item: menuItems, ownerUserId: restaurants.ownerUserId })
      .from(menuItems)
      .innerJoin(restaurants, eq(restaurants.id, menuItems.restaurantId))
      .where(eq(menuItems.id, menuItemId))
      .limit(1);

    if (!existing || existing.ownerUserId !== accountId) {
      throw new NotFoundException({ message: 'ไม่พบเมนูนี้' });
    }

    const [row] = await this.db
      .update(menuItems)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.price !== undefined ? { priceSatang: patch.price } : {}),
        ...(patch.isAvailable !== undefined ? { isAvailable: patch.isAvailable } : {}),
      })
      .where(eq(menuItems.id, menuItemId))
      .returning();

    return this.publicMenuItem(row!);
  }

  /** รูปร่างเดียวกับที่ /catalog ตอบ เพื่อให้จอเมนูใช้ชนิดเดียวกันทั้งฝั่งลูกค้าและฝั่งร้าน */
  private publicMenuItem(r: typeof menuItems.$inferSelect) {
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      name: r.name,
      ...(r.description ? { description: r.description } : {}),
      price: r.priceSatang,
      category: r.category,
      isAvailable: r.isAvailable,
      optionGroups: r.optionGroups as unknown[],
    };
  }
}
