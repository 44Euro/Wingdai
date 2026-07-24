import { seedRestaurants, seedMenuItems } from '../../src/data/mock/seed';

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
});
