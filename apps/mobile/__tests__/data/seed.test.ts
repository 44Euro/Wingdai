import {
  seedRestaurants, seedMenuItems, seedRestaurantCoords, seedAddresses, demoShops,
} from '../../src/data/mock/seed';
import { createMockRepos } from '../../src/data/mock';

describe('seed data', () => {
  it('ร้าน approved ทุกร้านมี cuisine/distanceKm/prepTimeMinutes', () => {
    const approved = seedRestaurants.filter((r) => r.isApproved);
    expect(approved.length).toBeGreaterThanOrEqual(2);
    approved.forEach((r) => {
      expect(typeof r.cuisine).toBe('string');
      expect(r.distanceKm).toBeGreaterThan(0);
      expect(r.prepTimeMinutes).toBeGreaterThan(0);
    });
  });

  it('ร้าน approved ทุกร้านมีเมนูอย่างน้อย 1 รายการ ราคาเป็นสตางค์ integer บวก', () => {
    seedRestaurants
      .filter((r) => r.isApproved)
      .forEach((r) => {
        const menu = seedMenuItems.filter((m) => m.restaurantId === r.id);
        expect(menu.length).toBeGreaterThanOrEqual(1);
        menu.forEach((m) => {
          expect(Number.isInteger(m.price)).toBe(true);
          expect(m.price).toBeGreaterThan(0);
        });
      });
  });

  it('ข้าวกะเพรา (m-malee-1) มี option groups และมีกลุ่มบังคับเลือกอย่างน้อยหนึ่ง', () => {
    const item = seedMenuItems.find((m) => m.id === 'm-malee-1');
    expect(item?.optionGroups?.length).toBeGreaterThanOrEqual(1);
    const required = item!.optionGroups!.filter((g) => g.minSelect >= 1);
    expect(required.length).toBeGreaterThanOrEqual(1);
  });

  it('เมนูจานหลักหลายรายการมี option groups และทุกกลุ่มถูกต้อง (max>=min, priceDelta integer>=0)', () => {
    const withOptions = seedMenuItems.filter((m) => m.optionGroups && m.optionGroups.length > 0);
    expect(withOptions.length).toBeGreaterThanOrEqual(5);
    withOptions.forEach((m) => {
      m.optionGroups!.forEach((g) => {
        expect(g.maxSelect).toBeGreaterThanOrEqual(g.minSelect);
        expect(g.choices.length).toBeGreaterThanOrEqual(1);
        g.choices.forEach((c) => {
          expect(Number.isInteger(c.priceDelta)).toBe(true);
          expect(c.priceDelta).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  it('ทุกร้านมีพิกัด ไม่งั้นหมุดบนแผนที่กับการคิดระยะจะหายไปเงียบ ๆ', () => {
    seedRestaurants.forEach((r) => {
      expect(seedRestaurantCoords[r.id]).toBeDefined();
    });
  });

  /** ระยะที่โชว์ต้องตรงกับพิกัดจริง ถ้าเพี้ยน จอลูกค้าจะบอก "0.6 กม." */
  it('distanceKm ตรงกับระยะที่คำนวณจากพิกัดจริง', () => {
    const home = seedAddresses[0]!;
    const ids = new Set(demoShops.map((s) => s.id));

    seedRestaurants.filter((r) => ids.has(r.id)).forEach((r) => {
      const c = seedRestaurantCoords[r.id]!;
      const dLat = (c.lat - home.lat) * 111.32;
      const dLng = (c.lng - home.lng) * 108.12;
      const actual = Math.sqrt(dLat * dLat + dLng * dLng);
      // ยอมคลาดเคลื่อน 100 ม. จากการปัดพิกัดห้าตำแหน่ง
      expect(Math.abs(actual - r.distanceKm!)).toBeLessThan(0.1);
    });
  });
});

/** ชุดร้านสาธิต มีไว้ให้ทุกจอมีของจริงให้ดูตอนพรีเซนต์ */
describe('ชุดร้านสาธิต', () => {
  it('มีร้านมากพอให้รายการดูเหมือนแอปจริง และครบทุกหมวด', async () => {
    const repos = createMockRepos();
    const shops = await repos.catalog.listRestaurants();
    expect(shops.length).toBeGreaterThanOrEqual(15);

    const cuisines = new Set(shops.map((s) => s.cuisine));
    expect(cuisines.size).toBe(5);
  });

  /** §7 ร้านเปิดที่ไหนในไทยก็ได้ สิ่งที่จำกัดคือ ระยะต่อออร์เดอร์ไม่เกิน 5 กม. */
  it('ร้านนอกรัศมี 5 กม. ไม่โผล่ในรายการของลูกค้า แม้จะมีอยู่ในระบบ', async () => {
    const repos = createMockRepos();
    const far = demoShops.filter((s) => s.km > 5);
    expect(far.length).toBeGreaterThan(0);

    const shops = await repos.catalog.listRestaurants();
    expect(shops.every((s) => s.distanceKm !== null && s.distanceKm <= 5)).toBe(true);
    for (const s of far) {
      expect(shops.some((x) => x.id === s.id)).toBe(false);
    }
  });

  it('ค้นหาก็ต้องกรองด้วยรัศมีเดียวกัน ไม่ใช่ประตูหลัง', async () => {
    const repos = createMockRepos();
    const far = demoShops.find((s) => s.km > 5)!;
    const hits = await repos.catalog.searchRestaurants(far.name);
    expect(hits.some((h) => h.id === far.id)).toBe(false);
  });

  it('ทุกร้านสาธิตมีเมนู และมีของที่หมดไว้ให้เห็นป้าย "หมด"', async () => {
    const repos = createMockRepos();
    for (const s of demoShops) {
      // eslint-disable-next-line no-await-in-loop
      const menu = await repos.catalog.getMenu(s.id);
      expect(menu.length).toBeGreaterThanOrEqual(3);
      expect(menu.some((m) => !m.isAvailable)).toBe(true);
    }
  });

  it('มีร้านที่ปิดอยู่ให้เห็นสถานะปิดในรายการ', async () => {
    const repos = createMockRepos();
    const shops = await repos.catalog.listRestaurants();
    expect(shops.some((s) => !s.isOpen)).toBe(true);
  });
});
