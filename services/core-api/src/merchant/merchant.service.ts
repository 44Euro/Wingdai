import {
  Injectable, Inject, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { and, eq, inArray, asc, desc, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { orders, orderItems, restaurants, menuItems, accounts } from '../db/schema';
import type { OrderStatus } from '../orders/stateMachine';
import type {
  CreateMenuItemInput, UpdateMenuItemInput, RegisterRestaurantInput, SetHoursInput,
} from './dto';
import {
  effectiveIsOpen, parseWeeklyHours, MAX_PAUSE_MINUTES, type WeeklyHours,
} from './openingHours';

/** §7 "ต้องมีเมนูตั้งต้นก่อนถึงจะส่งให้ตรวจได้" ตัวเลขนี้เลือกเอง product-spec ไม่ได้ระบุ */
const MIN_STARTER_MENU_ITEMS = 3;

/** สิ่งที่ครัวต้องเห็นเพื่อทำอาหารและตัดสินใจรับงาน มากกว่าที่ลูกค้าเห็นในบางช่อง */
export type MerchantOrder = {
  id: string;
  reference: string;
  restaurantId: string;
  restaurantName: string;
  status: OrderStatus;
  /** ชื่อลูกค้าไว้ขานตอนไรเดอร์มารับ ไม่ใช่ไว้ติดต่อ */
  customerName: string;
  items: {
    name: string; unitPrice: number; quantity: number;
    /** ข้อความที่ลูกค้าฝากถึงร้านสำหรับจานนี้ ครัวต้องเห็นก่อนลงมือทำ */
    note?: string;
  }[];
  foodTotal: number;
  /** 15% ของค่าอาหาร ที่แช่แข็งไว้ตอนสั่ง (§6.1) ไม่คำนวณสดตอนอ่าน */
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
  /** ตารางที่ร้านตั้งไว้ (design M11) ว่าง = ยังไม่เคยตั้ง ซึ่งแปลว่าเปิดตลอดเวลาที่สวิตช์เปิด */
  openingHours: WeeklyHours;
  /** พักรับออเดอร์ถึงเมื่อไหร่ `null` = ไม่ได้พัก */
  pausedUntil: string | null;
  /** รับออเดอร์ได้จริงไหม ณ ตอนนี้ รวมสวิตช์ ตาราง และการพักไว้แล้ว */
  isAcceptingOrders: boolean;
};

/** งานฝั่ง "คิว" ที่ครัวต้องทำต่อ vs. งานที่จบจากมือร้านไปแล้ว */
const QUEUE_STATUSES: OrderStatus[] = ['created', 'accepted', 'preparing'];
const DONE_STATUSES: OrderStatus[] = ['picked_up', 'delivered', 'cancelled'];

/** ยอดขายของช่วงเวลาหนึ่ง ทุกช่องเป็นจำนวนเต็มสตางค์ (§5 กฎข้อ 1) */
export type MerchantSales = {
  orders: number;
  foodSalesSatang: number;
  commissionSatang: number;
  /** ยอดที่ร้านจะได้รับจริง = ค่าอาหาร − คอมมิชชัน ไม่รวมค่าส่ง/ค่าบริการซึ่งไม่ใช่ของร้าน */
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

  /** ร้านทั้งหมดที่บัญชีนี้เป็นเจ้าของ รวมร้านที่ยังรออนุมัติ เพื่อให้จอบอกสถานะได้ */
  async myRestaurants(accountId: string): Promise<MerchantRestaurant[]> {
    const rows = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.ownerUserId, accountId))
      .orderBy(asc(restaurants.createdAt));
    return rows.map((r) => this.toPublicRestaurant(r));
  }

  /** ร้านนี้เป็นของบัญชีนี้จริงไหม */
  private async assertOwns(accountId: string, restaurantId: string) {
    const [row] = await this.db
      .select()
      .from(restaurants)
      .where(and(eq(restaurants.id, restaurantId), eq(restaurants.ownerUserId, accountId)))
      .limit(1);
    if (!row) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    return row;
  }

  /** ยอดขายของร้าน (design M1 M5) */
  async summary(accountId: string, restaurantId?: string) {
    const mine = await this.myRestaurants(accountId);
    const allowed = restaurantId ? mine.filter((r) => r.id === restaurantId) : mine;
    if (allowed.length === 0) {
      return {
        today: EMPTY_SALES, last7Days: EMPTY_SALES, openQueue: 0, restaurantCount: 0,
      };
    }

    /** ดึงใบของ 7 วันมารวมเองใน TypeScript แทนที่จะเขียน SQL รวมยอด */
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
      /** ใบที่ครัวยังต้องทำ ตัวเลขที่ร้านต้องเห็นก่อนตัวเลขเงินเสมอ */
      openQueue: queue.length,
      restaurantCount: allowed.length,
    };
  }

  /** ออเดอร์ของร้านที่บัญชีนี้เป็นเจ้าของ */
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
      // จอยอดขายรวมยอดจากรายการชุดนี้ ตัดที่ 50 แล้วยอดเดือนจะขาด
      .limit(queue ? 100 : 400);

    if (rows.length === 0) return [];

    /** ดึงรายการอาหารของทุกใบในคิวด้วยคำสั่งเดียว */
    const items = await this.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, rows.map((r) => r.order.id)))
      .orderBy(asc(orderItems.name));

    const byOrder = new Map<string, MerchantOrder['items']>();
    for (const i of items) {
      const list = byOrder.get(i.orderId) ?? [];
      list.push({
        name: i.name,
        unitPrice: i.unitPriceSatang,
        quantity: i.quantity,
        // คำสั่งพิเศษต้องไปถึงครัว ไม่งั้นลูกค้าพิมพ์ไปก็เท่านั้น
        ...(i.note ? { note: i.note } : {}),
      });
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

  /** ร้านกดเปิด/ปิดรับออเดอร์เอง ต่างจาก isApproved ที่แอดมินคุม */
  async setOpen(accountId: string, restaurantId: string, isOpen: boolean): Promise<MerchantRestaurant> {
    const shop = await this.assertOwns(accountId, restaurantId);
    if (!shop.isApproved && isOpen) {
      throw new NotFoundException({ message: 'ร้านนี้ยังรออนุมัติ เปิดรับออเดอร์ไม่ได้' });
    }

    const [row] = await this.db
      .update(restaurants)
      // กดเปิดร้านคือการล้างการพักด้วย ไม่งั้นร้านจะกดเปิดแล้วยังปิดอยู่โดยไม่รู้ว่าเพราะอะไร
      .set(isOpen ? { isOpen, pausedUntil: null } : { isOpen })
      .where(eq(restaurants.id, restaurantId))
      .returning();

    return this.toPublicRestaurant(row!);
  }

  /** ตั้งตารางเวลาเปิด-ปิด (design M11) */
  async setHours(
    accountId: string,
    restaurantId: string,
    input: SetHoursInput,
  ): Promise<MerchantRestaurant> {
    await this.assertOwns(accountId, restaurantId);

    for (const [day, value] of Object.entries(input.hours)) {
      if (value && value.open === value.close) {
        throw new BadRequestException({
          message: `เวลาเปิดกับเวลาปิดของวัน${day}ตรงกัน ถ้าจะหยุดให้เลือกว่าปิดทั้งวัน`,
        });
      }
    }

    const [row] = await this.db
      .update(restaurants)
      .set({ openingHours: input.hours })
      .where(eq(restaurants.id, restaurantId))
      .returning();

    return this.toPublicRestaurant(row!);
  }

  /** พักรับออเดอร์ชั่วคราวตอนครัวล้นมือ (design M11) `minutes: 0` = กลับมารับเดี๋ยวนี้ */
  async pause(
    accountId: string,
    restaurantId: string,
    minutes: number,
  ): Promise<MerchantRestaurant> {
    await this.assertOwns(accountId, restaurantId);
    if (minutes > MAX_PAUSE_MINUTES) {
      throw new BadRequestException({
        message: `พักได้ครั้งละไม่เกิน ${MAX_PAUSE_MINUTES} นาที นานกว่านั้นให้ปิดร้าน`,
      });
    }

    const [row] = await this.db
      .update(restaurants)
      .set({ pausedUntil: minutes === 0 ? null : new Date(Date.now() + minutes * 60_000) })
      .where(eq(restaurants.id, restaurantId))
      .returning();

    return this.toPublicRestaurant(row!);
  }

  /** เปิดร้าน product-spec §4.3 บัญชี `user` ที่ล็อกอินอยู่กรอกฟอร์มแล้วส่งให้แอดมินอนุมัติ */
  async registerRestaurant(accountId: string, input: RegisterRestaurantInput) {
    const [me] = await this.db
      .select({ accountType: accounts.accountType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (me?.accountType !== 'user') {
      throw new ForbiddenException({ message: 'เปิดร้านได้เฉพาะบัญชีลูกค้าเท่านั้น' });
    }

    /** ร้านเปิดได้ทุกที่ในประเทศไทย ไม่มีด่านโซนอีกแล้ว */
    const [zone] = await this.db.execute<{ id: string; name: string }>(sql`
      select id, name from zones
       where is_active = true
         and st_contains(
               st_setsrid(st_geomfromgeojson(boundary_geojson::text), 4326),
               st_setsrid(st_makepoint(${input.lng}, ${input.lat}), 4326)
             )
       limit 1
    `);

    const [row] = await this.db
      .insert(restaurants)
      .values({
        ownerUserId: accountId,
        zoneId: zone?.id ?? null,
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

    return { ...this.toPublicRestaurant(row!), zoneName: zone?.name ?? null };
  }

  /** ส่งร้านให้แอดมินตรวจ §7 กำหนดว่าต้องมี "เมนูตั้งต้น" ก่อนถึงจะส่งได้ */
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

    /** ยังไม่มีการอัปโหลดรูปหน้าร้าน/เอกสารจริง เพราะยังไม่ได้ต่อ Supabase Storage */
    return { submitted: true, awaitingReview: true };
  }

  /** ร้านที่รอตรวจ คิวของแอดมิน */
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

  /** แอดมินอนุมัติ จุดเดียวที่ร้านโผล่ให้ลูกค้าเห็น */
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
    const hours = parseWeeklyHours(r.openingHours);
    const at = new Date();
    return {
      id: r.id,
      name: r.name,
      isApproved: r.isApproved,
      isOpen: r.isOpen,
      prepTimeMinutes: r.prepTimeMinutes,
      openingHours: hours,
      // ค่าที่หมดอายุแล้วส่งไปเป็น null เลย ไม่ให้แอปต้องเทียบเวลาเองว่ายังพักอยู่ไหม
      pausedUntil:
        r.pausedUntil && r.pausedUntil.getTime() > at.getTime()
          ? r.pausedUntil.toISOString()
          : null,
      isAcceptingOrders: effectiveIsOpen({
        isOpen: r.isOpen,
        isApproved: r.isApproved,
        hours,
        pausedUntil: r.pausedUntil,
        at,
      }),
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

  /** แก้เมนู ที่ใช้บ่อยที่สุดคือกด "ของหมด" ระหว่างวัน */
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
