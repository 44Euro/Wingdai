import { create } from 'zustand';
import type { MenuItem } from '../../data/types';

export type SelectedChoice = { groupId: string; choiceId: string; name: string; priceDelta: number };

export type CartLine = {
  /** identity ของบรรทัด: menuItemId + choiceIds ที่เรียงแล้ว + ข้อความถึงร้าน */
  lineId: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  selectedChoices: SelectedChoice[];
  /** basePrice + ผลรวม priceDelta ของ option ที่เลือก */
  unitPrice: number;
  quantity: number;
  /** ข้อความฝากถึงร้านสำหรับจานนี้ เช่น "ไม่ใส่ผักชี" */
  note?: string;
};

type AddLineInput = {
  menuItem: MenuItem;
  selectedChoices: SelectedChoice[];
  quantity?: number;
  note?: string;
};

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
  /** ลูกค้าขอให้วางไว้หน้าประตู (สเปคคลื่น 2 §7) */
  leaveAtDoor: boolean;
  setLeaveAtDoor: (value: boolean) => void;
};

function computeLineId(menuItemId: string, choices: SelectedChoice[], note?: string): string {
  const ids = choices.map((c) => c.choiceId).sort().join(',');
  const trimmed = note?.trim() ?? '';
  if (ids === '' && trimmed === '') return menuItemId;
  return `${menuItemId}|${ids}|${trimmed}`;
}

export const useCartStore = create<CartState>((set, get) => ({
  restaurantId: null,
  lines: [],
  leaveAtDoor: false,

  addLine(restaurantId, { menuItem, selectedChoices, quantity = 1, note }) {
    const { restaurantId: current, lines } = get();
    if (current && current !== restaurantId) {
      // กันตะกร้าปนร้าน UI ต้อง clear() ก่อน (แสดง confirm) แล้วค่อยเรียกใหม่
      throw new Error('cart.differentRestaurant');
    }
    const lineId = computeLineId(menuItem.id, selectedChoices, note);
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
            ...(note?.trim() ? { note: note.trim() } : {}),
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
    // ล้าง `leaveAtDoor` ด้วย คำขอของใบที่แล้วต้องไม่ติดมากับใบใหม่
    set({ restaurantId: null, lines: [], leaveAtDoor: false });
  },

  setLeaveAtDoor(value) {
    set({ leaveAtDoor: value });
  },

  foodTotal() {
    return get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  },
}));
