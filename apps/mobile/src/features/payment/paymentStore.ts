import { create } from 'zustand';
import type { IconName } from '../../ui/Icon';
import type { PaymentMethod } from '../../data/types';

export type { PaymentMethod };

/** ลำดับที่แสดงบนจอ พร้อมเพย์มาก่อนเสมอตาม product-spec §3 ข้อ 5 (ทางที่ง่ายที่สุด) */
export const PAYMENT_METHODS: PaymentMethod[] = ['promptpay', 'cash', 'card'];

/** ช่องทางที่ใช้ได้แน่ ๆ ก่อนที่ค่าจากเซิร์ฟเวอร์จะมาถึง */
const ALWAYS_AVAILABLE: PaymentMethod[] = ['promptpay'];

export function isPayable(method: PaymentMethod, available: PaymentMethod[]): boolean {
  return available.includes(method);
}

export const PAYMENT_ICON: Record<PaymentMethod, IconName> = {
  promptpay: 'qr',
  cash: 'cart',
  card: 'card',
};

type PaymentState = {
  /** ช่องทางเริ่มต้นของลูกค้าคนนี้ พร้อมเพย์ตาม §3 ข้อ 5 (ค่าธรรมเนียมต่ำสุด) */
  method: PaymentMethod;
  /** ช่องทางที่เซิร์ฟเวอร์ยอมรับจริง มาจาก `GET /config` ไม่ใช่รายการตายตัวในแอป */
  available: PaymentMethod[];
  setMethod: (m: PaymentMethod) => void;
  setAvailable: (list: PaymentMethod[]) => void;
};

export const usePaymentStore = create<PaymentState>((set, get) => ({
  method: 'promptpay',
  available: ALWAYS_AVAILABLE,

  setMethod(m) {
    if (!isPayable(m, get().available)) return;
    set({ method: m });
  },

  /** ต้องย้ายช่องทางที่ลูกค้าเลือกไว้ด้วยถ้ามันเพิ่งถูกปิด */
  setAvailable(list) {
    const available = list.length > 0 ? list : ALWAYS_AVAILABLE;
    const method = isPayable(get().method, available) ? get().method : available[0]!;
    set({ available, method });
  },
}));
