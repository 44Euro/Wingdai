import { create } from 'zustand';
import type { MenuItem } from '../../data/types';

export type CartLine = { menuItemId: string; name: string; unitPrice: number; quantity: number };

type CartState = {
  restaurantId: string | null;
  lines: CartLine[];
  addItem: (restaurantId: string, item: MenuItem) => void;
  removeItem: (menuItemId: string) => void;
  setQuantity: (menuItemId: string, qty: number) => void;
  clear: () => void;
  foodTotal: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  restaurantId: null,
  lines: [],

  addItem(restaurantId, item) {
    const { restaurantId: current, lines } = get();
    if (current && current !== restaurantId) {
      // กันตะกร้าปนร้าน — UI ต้อง clear() ก่อน (แสดง confirm) แล้วค่อยเรียกใหม่
      throw new Error('cart.differentRestaurant');
    }
    const existing = lines.find((l) => l.menuItemId === item.id);
    const nextLines = existing
      ? lines.map((l) => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l))
      : [...lines, { menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: 1 }];
    set({ restaurantId, lines: nextLines });
  },

  removeItem(menuItemId) {
    const lines = get().lines.filter((l) => l.menuItemId !== menuItemId);
    set({ lines, restaurantId: lines.length ? get().restaurantId : null });
  },

  setQuantity(menuItemId, qty) {
    if (qty <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set({ lines: get().lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: qty } : l)) });
  },

  clear() {
    set({ restaurantId: null, lines: [] });
  },

  foodTotal() {
    return get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  },
}));
