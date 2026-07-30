import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { sql, eq, and, asc } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { restaurants, menuItems, addresses } from '../db/schema';

/**
 * รูปร่างเดียวกับ Restaurant ในแอปมือถือ เพื่อให้สลับจากรีโปจำลองมาเป็นของจริงได้โดยไม่แก้จอ
 *
 * `rating` กับ `distanceKm` เป็น null ได้ และ **จงใจไม่ใส่ค่าปลอมแทน**
 * - rating ต้องมาจากรีวิวจริง ซึ่งยังไม่มีระบบรีวิว (คลื่นที่ 3) — ★ 4.8 บนร้านที่ไม่มีใครรีวิว
 *   คือการหลอกลูกค้า ไม่ใช่ placeholder
 * - distanceKm รู้ได้ต่อเมื่อรู้ว่าลูกค้าอยู่ไหน ถ้ายังไม่ได้ล็อกอินหรือยังไม่มีที่อยู่ ก็ไม่รู้จริง ๆ
 */
export type PublicRestaurant = {
  id: string;
  ownerUserId: string;
  name: string;
  isApproved: boolean;
  isOpen: boolean;
  cuisine: 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert';
  distanceKm: number | null;
  prepTimeMinutes: number;
  rating: number | null;
};

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * ระยะทางจากที่อยู่ตั้งต้นของลูกค้าถึงร้าน เป็นกิโลเมตร ปัดทศนิยมหนึ่งตำแหน่ง
   *
   * cast เป็น geography ก่อนวัด เพราะ ST_Distance บน geometry SRID 4326 คืนค่าเป็น "องศา"
   * ซึ่งไม่ใช่หน่วยระยะทางและเพี้ยนตามละติจูด — บน geography ได้เมตรจริงบนผิวโลก
   */
  private distanceExpr(fromAddressId: string | null) {
    if (!fromAddressId) return sql<number | null>`null`;
    /*
     * ต้องระบุชื่อตารางเต็ม ๆ ห้ามใช้ ${restaurants.location} เฉย ๆ
     *
     * drizzle เรนเดอร์คอลัมน์ของตารางหลักเป็น "location" ล้วน ไม่มีชื่อตารางนำหน้า
     * พอไปอยู่ใน subquery ที่ from "addresses" a ชื่อนั้นจะไปชนกับ a.location
     * กลายเป็นวัดระยะจากที่อยู่ไปหาตัวเอง = 0 ทุกแถว **โดยไม่มี error ให้เห็น**
     * เลขที่ได้ดูสมเหตุสมผลจนแทบไม่มีทางสังเกต ถ้าไม่ไปเทียบกับค่าที่คำนวณมือ
     */
    const restaurantLocation = sql`${sql.identifier('restaurants')}.${sql.identifier('location')}`;
    /*
     * ปิดท้ายด้วย ::float8 ไม่ใช่ปล่อยเป็น numeric
     * เพราะ postgres.js คืน numeric มาเป็น **สตริง** ("0.2") เพื่อรักษาความละเอียด
     * ซึ่งไม่ตรงกับชนิด number ที่ฝั่งแอปประกาศไว้ แล้วไปพังตอนเรียก .toFixed() ในจอ
     * ระยะทางไม่ใช่เงิน จึงใช้ทศนิยมลอยตัวได้ (ยอดเงินยังเป็นสตางค์จำนวนเต็มเสมอ §5)
     */
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
      distanceKm: this.distanceExpr(fromAddressId),
      // ยังไม่มีตารางรีวิว — คลื่นที่ 3 ค่อยเปลี่ยนตรงนี้เป็นค่าเฉลี่ยจริง
      rating: sql<number | null>`null`,
    };
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

  /** ลูกค้าเห็นเฉพาะร้านที่แอดมินอนุมัติแล้ว ร้านที่รออนุมัติต้องไม่โผล่ */
  async list(accountId: string | null): Promise<PublicRestaurant[]> {
    const from = await this.defaultAddressId(accountId);
    return this.db
      .select(this.selection(from))
      .from(restaurants)
      .where(eq(restaurants.isApproved, true))
      .orderBy(asc(restaurants.name));
  }

  async get(id: string, accountId: string | null): Promise<PublicRestaurant> {
    const from = await this.defaultAddressId(accountId);
    const [row] = await this.db
      .select(this.selection(from))
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    if (!row) throw new NotFoundException({ message: 'ไม่พบร้านนี้' });
    return row;
  }

  /**
   * ค้นจาก **ชื่อร้านหรือชื่อเมนูในร้านนั้น** (design C2 "ค้นหาร้านหรือเมนู")
   * ทำที่นี่ไม่ใช่ในแอป เพราะแอปไม่ควรดึงเมนูทุกร้านมาไว้ในเครื่องเพื่อค้นเอง
   */
  async search(query: string, accountId: string | null): Promise<PublicRestaurant[]> {
    const q = query.trim();
    if (q === '') return [];
    const from = await this.defaultAddressId(accountId);
    const pattern = `%${q}%`;

    return this.db
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
      optionGroups: m.optionGroups,
    }));
  }
}
