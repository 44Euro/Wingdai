import {
  Injectable, Inject, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { and, eq, inArray, asc, desc, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { orders, orderItems, restaurants, menuItems, accounts } from '../db/schema';
import type { OrderStatus } from '../orders/stateMachine';
import type {
  CreateMenuItemInput, UpdateMenuItemInput, RegisterRestaurantInput,
} from './dto';

/**
 * §7 "ต้องมีเมนูตั้งต้นก่อนถึงจะส่งให้ตรวจได้" — ตัวเลขนี้เลือกเอง claude.md ไม่ได้ระบุ
 * 3 รายการคือน้อยสุดที่ยังดูเหมือนร้านจริง ไม่ใช่ร้านที่เปิดมาลองเล่น
 */
const MIN_STARTER_MENU_ITEMS = 3;

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

/** ยอดขายของช่วงเวลาหนึ่ง — ทุกช่องเป็นจำนวนเต็มสตางค์ (§5 กฎข้อ 1) */
export type MerchantSales = {
  orders: number;
  foodSalesSatang: number;
  commissionSatang: number;
  /** ยอดที่ร้านจะได้รับจริง = ค่าอาหาร − คอมมิชชัน — ไม่รวมค่าส่ง/ค่าบริการซึ่งไม่ใช่ของร้าน */
  netSatang: number;
};

const EMPTY_SALES: MerchantSales = {
  orders: 0, foodSalesSatang: 0, commissionSatang: 0, netSatang: 0,
};

function salesOf(rows: { foodTotalSatang: number; commissionSatang: number }[]): MerchantSales {
  const foodSalesSatang = rows.reduce((s, r) => s + r.foodTotalSatang, 0);
  const commissionSatang = rows.reduce((s, r) => s + r.commissionSatang, 0);
  return {
    orders: rows.length,
    foodSalesSatang,
    commissionSatang,
    netSatang: foodSalesSatang - commissionSatang,
  };
}

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
   * ยอดขายของร้าน (design M1 · M5)
   *
   * นับเฉพาะใบที่ **ส่งถึงแล้ว** — ใบที่ยังทำอยู่หรือถูกยกเลิกยังไม่ใช่ยอดขาย
   * การนับใบที่ยังไม่จบด้วยจะทำให้ตัวเลขแกว่งลงตอนมีคนยกเลิก ซึ่งอ่านเหมือนระบบผิด
   *
   * คอมมิชชันอ่านจาก `orders.commission_satang` ที่บันทึกไว้ตอนสั่ง **ไม่คำนวณใหม่**
   * ถ้าอัตรา 15% (§6.1) เปลี่ยนวันหลัง ใบเก่าต้องยังโชว์ยอดตามอัตราที่ตกลงกันตอนนั้น
   */
  async summary(accountId: string, restaurantId?: string) {
    const mine = await this.myRestaurants(accountId);
    const allowed = restaurantId ? mine.filter((r) => r.id === restaurantId) : mine;
    if (allowed.length === 0) {
      return {
        today: EMPTY_SALES, last7Days: EMPTY_SALES, openQueue: 0, restaurantCount: 0,
      };
    }

    /*
     * ดึงใบของ 7 วันมารวมเองใน TypeScript แทนที่จะเขียน SQL รวมยอด
     * จำนวนใบต่อร้านใน 7 วันของเฟส 1 อยู่ในหลักร้อย การรวมในโค้ดจึงไม่ใช่ปัญหา
     * และได้ตัวเลขที่เขียนเทสต์ตรง ๆ ได้ แทนที่จะต้องเชื่อ filter (...) ใน SQL
     */
    const rows = await this.db
      .select({
        deliveredAt: orders.deliveredAt,
        foodTotalSatang: orders.foodTotalSatang,
        commissionSatang: orders.commissionSatang,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.restaurantId, allowed.map((r) => r.id)),
          eq(orders.status, 'delivered'),
          sql`${orders.deliveredAt} > now() - interval '7 days'`,
        ),
      );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayRows = rows.filter((r) => r.deliveredAt !== null && r.deliveredAt >= startOfToday);

    const queue = await this.listOrders(accountId, { restaurantId, scope: 'queue' });

    return {
      today: salesOf(todayRows),
      last7Days: salesOf(rows),
      /** ใบที่ครัวยังต้องทำ — ตัวเลขที่ร้านต้องเห็นก่อนตัวเลขเงินเสมอ */
      openQueue: queue.length,
      restaurantCount: allowed.length,
    };
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

  /**
   * เปิดร้าน — claude.md §4.3 บัญชี `user` ที่ล็อกอินอยู่กรอกฟอร์มแล้วส่งให้แอดมินอนุมัติ
   *
   * สร้างเป็นร้านที่ยัง **ไม่อนุมัติและปิดอยู่** เสมอ ไม่มีทางลัดให้เปิดขายได้เอง
   * เพราะร้านที่โผล่ให้ลูกค้าเห็นโดยไม่มีใครตรวจ คือความเสี่ยงทั้งเรื่องอาหารและเรื่องเงิน
   *
   * **ตีความจาก §4.1: เฉพาะบัญชีชนิด `user` เท่านั้น** ตารางในนั้นเขียนว่าร้านเป็น
   * "การอัปเกรดบนบัญชี user ที่มีอยู่" ไรเดอร์จึงเปิดร้านไม่ได้ — ทบทวนได้ถ้าไม่ตั้งใจแบบนั้น
   */
  async registerRestaurant(accountId: string, input: RegisterRestaurantInput) {
    const [me] = await this.db
      .select({ accountType: accounts.accountType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (me?.accountType !== 'user') {
      throw new ForbiddenException({ message: 'เปิดร้านได้เฉพาะบัญชีลูกค้าเท่านั้น' });
    }

    /*
     * §7 · §1 — พิกัดร้านต้องอยู่ในโซนที่เปิดให้บริการ
     * ปล่อยร้านนอกโซนเข้ามาเท่ากับทำลายสมมติฐานเรื่องความหนาแน่นที่โมเดลทั้งหมดยืนอยู่
     * (ระยะส่ง 1–1.5 กม. คือเหตุผลเดียวที่ GP 15% เป็นไปได้)
     */
    const [zone] = await this.db.execute<{ id: string; name: string }>(sql`
      select id, name from zones
       where is_active = true
         and st_contains(
               st_setsrid(st_geomfromgeojson(boundary_geojson::text), 4326),
               st_setsrid(st_makepoint(${input.lng}, ${input.lat}), 4326)
             )
       limit 1
    `);

    if (!zone) {
      throw new BadRequestException({
        message: 'ที่ตั้งร้านอยู่นอกโซนที่เปิดให้บริการ',
        fields: { addressText: 'ยังไม่เปิดให้บริการย่านนี้' },
      });
    }

    const [row] = await this.db
      .insert(restaurants)
      .values({
        ownerUserId: accountId,
        zoneId: zone.id,
        name: input.name,
        cuisine: input.cuisine,
        addressText: input.addressText,
        location: { x: input.lng, y: input.lat },
        prepTimeMinutes: input.prepTimeMinutes,
        openingHours: input.openingHours ?? {},
        bankName: input.bankName,
        bankAccountNumber: input.bankAccountNumber,
        bankAccountName: input.bankAccountName,
        isApproved: false,
        isOpen: false,
      })
      .returning();

    return { ...this.toPublicRestaurant(row!), zoneName: zone.name };
  }

  /**
   * ส่งร้านให้แอดมินตรวจ — §7 กำหนดว่าต้องมี "เมนูตั้งต้น" ก่อนถึงจะส่งได้
   *
   * ร้านที่อนุมัติแล้วแต่ไม่มีเมนู = ร้านที่ลูกค้ากดเข้าไปแล้วเจอหน้าว่าง
   * ซึ่งเสียลูกค้าคนนั้นไปเลย และเสียความน่าเชื่อถือของทั้งรายการร้าน
   */
  async submitForApproval(accountId: string, restaurantId: string) {
    const shop = await this.assertOwns(accountId, restaurantId);
    if (shop.isApproved) {
      throw new ConflictException({ message: 'ร้านนี้อนุมัติแล้ว' });
    }

    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(menuItems)
      .where(eq(menuItems.restaurantId, restaurantId));

    if ((count?.n ?? 0) < MIN_STARTER_MENU_ITEMS) {
      throw new BadRequestException({
        message: `ต้องมีเมนูอย่างน้อย ${MIN_STARTER_MENU_ITEMS} รายการก่อนส่งให้ตรวจ`,
        fields: { menu: `ตอนนี้มี ${count?.n ?? 0} รายการ` },
      });
    }

    /*
     * ยังไม่มีการอัปโหลดรูปหน้าร้าน/เอกสารจริง เพราะยังไม่ได้ต่อ Supabase Storage
     * §7 ระบุว่าต้องเก็บทั้งสองอย่าง — **ต้องบังคับให้ครบก่อนเปิดใช้จริง**
     * ตอนนี้ปล่อยผ่านโดยตั้งใจ ไม่ใช่ลืม จะได้ทดสอบเส้นทางที่เหลือได้
     */
    return { submitted: true, awaitingReview: true };
  }

  /** ร้านที่รอตรวจ — คิวของแอดมิน */
  async pendingRestaurants() {
    const rows = await this.db
      .select({ shop: restaurants, ownerName: accounts.fullName, ownerPhone: accounts.phone })
      .from(restaurants)
      .innerJoin(accounts, eq(accounts.id, restaurants.ownerUserId))
      .where(eq(restaurants.isApproved, false))
      .orderBy(asc(restaurants.createdAt));

    return Promise.all(
      rows.map(async (r) => {
        const [count] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(menuItems)
          .where(eq(menuItems.restaurantId, r.shop.id));
        return {
          ...this.toPublicRestaurant(r.shop),
          ownerName: r.ownerName,
          ownerPhone: r.ownerPhone,
          addressText: r.shop.addressText,
          menuItemCount: count?.n ?? 0,
          createdAt: r.shop.createdAt.toISOString(),
        };
      }),
    );
  }

  /**
   * แอดมินอนุมัติ — จุดเดียวที่ร้านโผล่ให้ลูกค้าเห็น
   * อนุมัติแล้ว **ยังไม่เปิดขาย** ร้านต้องกดเปิดเอง เพราะเจ้าของรู้ดีกว่าว่าพร้อมเมื่อไหร่
   */
  async setApproval(adminAccountId: string, restaurantId: string, approve: boolean) {
    const [row] = await this.db
      .update(restaurants)
      .set({ isApproved: approve, approvedAt: approve ? new Date() : null })
      .where(eq(restaurants.id, restaurantId))
      .returning();

    if (!row) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    return this.toPublicRestaurant(row);
  }

  private toPublicRestaurant(r: typeof restaurants.$inferSelect): MerchantRestaurant {
    return {
      id: r.id,
      name: r.name,
      isApproved: r.isApproved,
      isOpen: r.isOpen,
      prepTimeMinutes: r.prepTimeMinutes,
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
