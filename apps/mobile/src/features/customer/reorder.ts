import type { MenuItem, Order } from '../../data/types';
import type { SelectedChoice } from '../cart/cartStore';

/** ประกอบตะกร้าใบเดิมขึ้นมาใหม่จากออร์เดอร์เก่า (design C33) */
export type ReorderLine = {
  menuItem: MenuItem;
  selectedChoices: SelectedChoice[];
  quantity: number;
  note?: string;
};

export type ReorderPlan = {
  lines: ReorderLine[];
  /** ชื่อจานที่ใส่กลับไม่ได้ ต้องบอกลูกค้า ไม่ใช่เงียบ ๆ แล้วยอดน้อยกว่าที่เขาจำได้ */
  unavailable: string[];
};

export function planReorder(order: Order, menu: MenuItem[]): ReorderPlan {
  const lines: ReorderLine[] = [];
  const unavailable: string[] = [];

  for (const item of order.items) {
    const menuItem = menu.find((m) => m.id === item.menuItemId);
    // จานที่ร้านลบทิ้งหรือกดของหมดวันนี้ ใส่ไม่ได้ทั้งคู่ ลูกค้าเห็นเหตุผลเดียวกันคือ "วันนี้ไม่มี"
    if (!menuItem || !menuItem.isAvailable) {
      unavailable.push(item.name);
      continue;
    }

    const selectedChoices: SelectedChoice[] = [];
    let choiceMissing = false;
    for (const group of menuItem.optionGroups ?? []) {
      for (const choice of group.choices) {
        if (!item.choiceIds.includes(choice.id)) continue;
        selectedChoices.push({
          groupId: group.id,
          choiceId: choice.id,
          name: choice.name,
          priceDelta: choice.priceDelta,
        });
      }
      /** กลุ่มที่บังคับเลือกแต่ตัวเลือกเดิมหายไปแล้ว ใส่กลับไม่ได้ */
      const pickedInGroup = selectedChoices.filter((c) => c.groupId === group.id).length;
      if (pickedInGroup < group.minSelect) choiceMissing = true;
    }

    if (choiceMissing) {
      unavailable.push(item.name);
      continue;
    }

    lines.push({
      menuItem,
      selectedChoices,
      quantity: item.quantity,
      ...(item.note ? { note: item.note } : {}),
    });
  }

  return { lines, unavailable };
}
