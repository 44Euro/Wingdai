import { filterApproved } from '../../src/features/customer/hooks';
import type { Restaurant } from '../../src/data/types';

const r = (id: string, isApproved: boolean): Restaurant => ({
  id,
  ownerUserId: 'x',
  name: id,
  isApproved,
  isOpen: true,
  cuisine: 'rice',
  distanceKm: 1,
  prepTimeMinutes: 10,
  rating: 4.5,
});

describe('filterApproved', () => {
  it('คืนเฉพาะร้านที่อนุมัติแล้ว', () => {
    const out = filterApproved([r('a', true), r('b', false), r('c', true)]);
    expect(out.map((x) => x.id)).toEqual(['a', 'c']);
  });
});
