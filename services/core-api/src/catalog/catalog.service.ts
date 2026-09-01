import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { sql, eq, and, asc, desc } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { StorageService } from '../storage/storage.service';
import { restaurants, menuItems, addresses, reviews, favorites } from '../db/schema';
import { MAX_DELIVERY_RADIUS_KM } from '../orders/deliveryRadius';
import { effectiveIsOpen, nextOpenAt, parseWeeklyHours } from '../merchant/openingHours';

/** รูปร่างเดียวกับ Restaurant ในแอปมือถือ เพื่อให้สลับจากรีโปจำลองมาเป็นของจริงได้โดยไม่แก้จอ */
export type PublicRestaurant = {
  id: string;
  ownerUserId: string;
  name: string;
  isApproved: boolean;
  /** เปิดรับออร์เดอร์อยู่จริงไหม ไม่ใช่แค่ค่าสวิตช์ในฐาน รวมตารางเวลา (design M11) */
  isOpen: boolean;
  /** รอบเปิดถัดไปตามตาราง `null` = เปิดอยู่ หรือร้านไม่ได้ตั้งตารางไว้ */
  opensAt: string | null;
  cuisine: 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert';
  distanceKm: number | null;
  prepTimeMinutes: number;
  rating: number | null;
  /** รูปหน้าร้าน `null` = ร้านยังไม่ได้ใส่ จอจะวาดกล่องไล่สีแทน */
  photoUrl: string | null;
};

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  /** ระยะทางจากที่อยู่ตั้งต้นของลูกค้าถึงร้าน เป็นกิโลเมตร ปัดทศนิยมหนึ่งตำแหน่ง */
  private distanceExpr(fromAddressId: string | null) {
    if (!fromAddressId) return sql<number | null>`null`;
    /** ต้องระบุชื่อตารางเต็ม ๆ ห้ามใช้ ${restaurants.location} เฉย ๆ */
    const restaurantLocation = sql`${sql.identifier('restaurants')}.${sql.identifier('location')}`;
    /** ปิดท้ายด้วย ::float8 ไม่ใช่ปล่อยเป็น numeric */
    return sql<number | null>`round((
      select st_distance(${restaurantLocation}::geography, a.location::geography) / 1000.0
      from ${addresses} a where a.id = ${fromAddressId}
    )::numeric, 1)::float8`;
  }

  private selection(fromAddressId: string | null) {
    return {
      id: restaurants.id,
      ownerUserId: restaurants.ownerUserId,
      name: restaurants.name,
      isApproved: restaurants.isApproved,
      isOpen: restaurants.isOpen,
      cuisine: restaurants.cuisine,
      prepTimeMinutes: restaurants.prepTimeMinutes,
      openingHours: restaurants.openingHours,
      pausedUntil: restaurants.pausedUntil,
      storefrontPhotoPath: restaurants.storefrontPhotoPath,
      distanceKm: this.distanceExpr(fromAddressId),
      rating: this.ratingExpr(),
    };
  }

  /** แปลงแถวดิบเป็นสิ่งที่ลูกค้าเห็น ที่เดียวที่ตัดสินว่า "เปิดอยู่" แปลว่าอะไร */
  private toPublic(row: {
    openingHours: unknown;
    pausedUntil: Date | null;
    isApproved: boolean;
    isOpen: boolean;
    storefrontPhotoPath: string | null;
  } & Omit<PublicRestaurant, 'isOpen' | 'opensAt' | 'isApproved' | 'photoUrl'>): PublicRestaurant {
    const { openingHours, pausedUntil, storefrontPhotoPath, ...rest } = row;
    const hours = parseWeeklyHours(openingHours);
    const at = new Date();
    const opensAt = nextOpenAt(hours, at);
    return {
      ...rest,
      photoUrl: storefrontPhotoPath ? this.storage.publicUrl(storefrontPhotoPath) : null,
      isOpen: effectiveIsOpen({
        isOpen: row.isOpen, isApproved: row.isApproved, hours, pausedUntil, at,
      }),
      opensAt: opensAt ? opensAt.toISOString() : null,
    };
  }

  /** คะแนนเฉลี่ยจากรีวิวจริง `avg` ของเซ็ตว่างคือ NULL อยู่แล้ว ร้านที่ยังไม่มีใครรีวิว */
  private ratingExpr() {
    const restaurantId = sql`${sql.identifier('restaurants')}.${sql.identifier('id')}`;
    return sql<number | null>`(
      select round(avg(rv.restaurant_rating)::numeric, 1)::float8
        from ${reviews} rv where rv.restaurant_id = ${restaurantId}
    )`;
  }

  /** ที่อยู่ตั้งต้นของลูกค้า = ที่อยู่แรกที่บันทึกไว้ ใช้คิดระยะทาง */
  private async defaultAddressId(accountId: string | null): Promise<string | null> {
    if (!accountId) return null;
    const [row] = await this.db
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.accountId, accountId))
      .orderBy(asc(addresses.createdAt))
      .limit(1);
    return row?.id ?? null;
  }

  /** เงื่อนไขระยะส่ง ร้านต้องอยู่ในรัศมี MAX_DELIVERY_RADIUS_KM จากที่อยู่ของลูกค้า */
  private withinRadius(fromAddressId: string | null) {
    if (!fromAddressId) return undefined;
    const restaurantLocation = sql`${sql.identifier('restaurants')}.${sql.identifier('location')}`;
    return sql`(
      select st_distance(${restaurantLocation}::geography, a.location::geography)
        from ${addresses} a where a.id = ${fromAddressId}
    ) <= ${MAX_DELIVERY_RADIUS_KM * 1000}`;
  }

  /** ลูกค้าเห็นเฉพาะร้านที่แอดมินอนุมัติแล้ว และอยู่ในระยะส่ง */
  async list(accountId: string | null): Promise<PublicRestaurant[]> {
    const from = await this.defaultAddressId(accountId);
    const near = this.withinRadius(from);
    const rows = await this.db
      .select(this.selection(from))
      .from(restaurants)
      .where(near ? and(eq(restaurants.isApproved, true), near) : eq(restaurants.isApproved, true))
      .orderBy(asc(restaurants.name));

    const list = rows.map((r) => this.toPublic(r));
    if (!from) return list;
    return list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  async get(id: string, accountId: string | null): Promise<PublicRestaurant> {
    const from = await this.defaultAddressId(accountId);
    const [row] = await this.db
      .select(this.selection(from))
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    if (!row) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    return this.toPublic(row);
  }

  /** ค้นจาก ชื่อร้านหรือชื่อเมนูในร้านนั้น (design C2 "ค้นหาร้านหรือเมนู") */
  async search(query: string, accountId: string | null): Promise<PublicRestaurant[]> {
    const q = query.trim();
    if (q === '') return [];
    const from = await this.defaultAddressId(accountId);
    const pattern = `%${q}%`;

    const found = await this.db
      .select(this.selection(from))
      .from(restaurants)
      .where(
        and(
          eq(restaurants.isApproved, true),
          sql`(${restaurants.name} ilike ${pattern} or exists (
            select 1 from ${menuItems} m
            where m.restaurant_id = ${restaurants.id} and m.name ilike ${pattern}
          ))`,
        ),
      )
      .orderBy(asc(restaurants.name));

    return found.map((r) => this.toPublic(r));
  }

  /** ร้านที่บัญชีนี้บันทึกไว้ (design C19) */
  async listFavorites(accountId: string): Promise<PublicRestaurant[]> {
    const from = await this.defaultAddressId(accountId);
    const rows = await this.db
      .select(this.selection(from))
      .from(restaurants)
      .innerJoin(favorites, eq(favorites.restaurantId, restaurants.id))
      .where(and(eq(favorites.accountId, accountId), eq(restaurants.isApproved, true)))
      .orderBy(desc(favorites.createdAt));
    return rows.map((r) => this.toPublic(r));
  }

  /** id ของร้านที่บันทึกไว้ จอรายการใช้ตัดสินว่าหัวใจดวงไหนทึบ โดยไม่ต้องดึงร้านซ้ำ */
  async favoriteIds(accountId: string): Promise<string[]> {
    const rows = await this.db
      .select({ restaurantId: favorites.restaurantId })
      .from(favorites)
      .where(eq(favorites.accountId, accountId));
    return rows.map((r) => r.restaurantId);
  }

  /** กดบันทึก/เอาออก คืนสถานะหลังกด ไม่ใช่ 204 เปล่า ๆ */
  async setFavorite(accountId: string, restaurantId: string, on: boolean): Promise<{ favorite: boolean }> {
    const [shop] = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(and(eq(restaurants.id, restaurantId), eq(restaurants.isApproved, true)))
      .limit(1);
    if (!shop) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });

    if (on) {
      await this.db
        .insert(favorites)
        .values({ accountId, restaurantId })
        .onConflictDoNothing();
    } else {
      await this.db
        .delete(favorites)
        .where(and(eq(favorites.accountId, accountId), eq(favorites.restaurantId, restaurantId)));
    }
    return { favorite: on };
  }

  async menu(restaurantId: string) {
    const rows = await this.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.restaurantId, restaurantId))
      .orderBy(asc(menuItems.createdAt));

    return rows.map((m) => ({
      id: m.id,
      restaurantId: m.restaurantId,
      name: m.name,
      description: m.description ?? undefined,
      price: m.priceSatang,
      category: m.category,
      isAvailable: m.isAvailable,
      photoUrl: m.photoPath ? this.storage.publicUrl(m.photoPath) : null,
      optionGroups: m.optionGroups,
    }));
  }
}
