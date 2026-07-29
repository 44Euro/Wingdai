import { create } from 'zustand';
import type { IconName } from '../../ui/Icon';
import type { PaymentMethod } from '../../data/types';

/**
 * `card` โผล่ในรายการแต่ยังเลือกไม่ได้ เพราะยังไม่ได้ตัดสินใจว่าจะใช้ payment gateway เจ้าไหน
 * (claude.md §11 ข้อ 3) — โชว์ไว้พร้อมป้ายบอกตรง ๆ ดีกว่าซ่อนแล้วลูกค้าไม่รู้ว่ามีแผน
 */
export type { PaymentMethod };

export const PAYMENT_METHODS: PaymentMethod[] = ['promptpay', 'cash', 'card'];

/** ช่องทางที่ใช้จ่ายได้จริงตอนนี้ */
export function isPayable(method: PaymentMethod): boolean {
  return method !== 'card';
}

export const PAYMENT_ICON: Record<PaymentMethod, IconName> = {
  promptpay: 'qr',
  cash: 'cart',
  card: 'card',
};

type PaymentState = {
  /** ช่องทางเริ่มต้นของลูกค้าคนนี้ — PromptPay ตาม claude.md §3 ข้อ 5 (ค่าธรรมเนียมต่ำสุด) */
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
};

export const usePaymentStore = create<PaymentState>((set) => ({
  method: 'promptpay',
  setMethod(m) {
    if (!isPayable(m)) return;
    set({ method: m });
  },
}));
