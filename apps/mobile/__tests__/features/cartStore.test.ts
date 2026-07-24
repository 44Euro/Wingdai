import { useCartStore } from '../../src/features/cart/cartStore';
import type { MenuItem } from '../../src/data/types';

const item = (id: string, price: number): MenuItem => ({
  id,
  restaurantId: 'r-malee',
  name: id,
  price,
  category: 'rice',
  isAvailable: true,
});

beforeEach(() => {
  useCartStore.getState().clear();
});

describe('cartStore', () => {
  it('addItem ตั้ง restaurantId และเพิ่ม quantity เมื่อเพิ่มซ้ำ', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    s.addItem('r-malee', item('m1', 5000));
    const st = useCartStore.getState();
    expect(st.restaurantId).toBe('r-malee');
    expect(st.lines).toHaveLength(1);
    expect(st.lines[0].quantity).toBe(2);
    expect(st.foodTotal()).toBe(10000);
  });

  it('setQuantity <=0 ลบรายการ', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    s.setQuantity('m1', 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('เพิ่มจากร้านอื่นโดยไม่ clear ก่อน → throw (กันตะกร้าปนร้าน)', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    expect(() => useCartStore.getState().addItem('r-somtam', item('m9', 4000))).toThrow();
  });

  it('clear แล้วเพิ่มร้านใหม่ได้', () => {
    const s = useCartStore.getState();
    s.addItem('r-malee', item('m1', 5000));
    s.clear();
    useCartStore.getState().addItem('r-somtam', item('m9', 4000));
    expect(useCartStore.getState().restaurantId).toBe('r-somtam');
  });
});
