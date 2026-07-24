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
});
