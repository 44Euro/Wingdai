import { create } from 'zustand';
import type { MenuItem } from '../../data/types';

export type SelectedChoice = { groupId: string; choiceId: string; name: string; priceDelta: number };

export type CartLine = {
  /** identity ของบรรทัด: ไม่มี option → = menuItemId; มี option → menuItemId|choiceIds เรียง */
  lineId: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  selectedChoices: SelectedChoice[];
  /** basePrice + ผลรวม priceDelta ของ option ที่เลือก */
  unitPrice: number;
  quantity: number;
};

type AddLineInput = { menuItem: MenuItem; selectedChoices: SelectedChoice[]; quantity?: number };

type CartState = {
  restaurantId: string | null;
  lines: CartLine[];
  addLine: (restaurantId: string, input: AddLineInput) => void;
  /** ทางลัดสำหรับเมนูที่ไม่มี option */
  addItem: (restaurantId: string, item: MenuItem) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, qty: number) => void;
  clear: () => void;
  foodTotal: () => number;
};

function computeLineId(menuItemId: string, choices: SelectedChoice[]): string {
  if (choices.length === 0) return menuItemId;
  const ids = choices.map((c) => c.choiceId).sort().join(',');
  return `${menuItemId}|${ids}`;
}

export const useCartStore = create<CartState>((set, get) => ({
  restaurantId: null,
  lines: [],

  addLine(restaurantId, { menuItem, selectedChoices, quantity = 1 }) {
    const { restaurantId: current, lines } = get();
    if (current && current !== restaurantId) {
      // กันตะกร้าปนร้าน — UI ต้อง clear() ก่อน (แสดง confirm) แล้วค่อยเรียกใหม่
      throw new Error('cart.differentRestaurant');
    }
    const lineId = computeLineId(menuItem.id, selectedChoices);
    const unitPrice = menuItem.price + selectedChoices.reduce((s, c) => s + c.priceDelta, 0);
    const existing = lines.find((l) => l.lineId === lineId);
    const nextLines = existing
      ? lines.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + quantity } : l))
      : [
          ...lines,
          {
            lineId,
            menuItemId: menuItem.id,
            name: menuItem.name,
            basePrice: menuItem.price,
            selectedChoices,
            unitPrice,
            quantity,
          },
        ];
    set({ restaurantId, lines: nextLines });
  },

  addItem(restaurantId, item) {
    get().addLine(restaurantId, { menuItem: item, selectedChoices: [], quantity: 1 });
  },

  removeItem(lineId) {
    const lines = get().lines.filter((l) => l.lineId !== lineId);
    set({ lines, restaurantId: lines.length ? get().restaurantId : null });
  },

  setQuantity(lineId, qty) {
    if (qty <= 0) {
      get().removeItem(lineId);
      return;
    }
    set({ lines: get().lines.map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l)) });
  },

  clear() {
    set({ restaurantId: null, lines: [] });
  },

  foodTotal() {
    return get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  },
}));
