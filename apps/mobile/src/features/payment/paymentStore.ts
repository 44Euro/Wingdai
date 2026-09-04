import { create } from 'zustand';
import type { IconName } from '../../ui/Icon';
import type { PaymentMethod, UnavailablePaymentMethod } from '../../data/types';

export type { PaymentMethod };

/** ลำดับที่แสดงบนจอ พร้อมเพย์มาก่อนเสมอตาม product-spec §3 ข้อ 5 (ทางที่ง่ายที่สุด) */
export const PAYMENT_METHODS: PaymentMethod[] = ['promptpay', 'cash', 'card'];

/** ช่องทางที่ใช้ได้แน่ ๆ ก่อนที่ค่าจากเซิร์ฟเวอร์จะมาถึง */
const ALWAYS_AVAILABLE: PaymentMethod[] = ['promptpay'];

/**
 * ค่าเริ่มต้นก่อน `GET /config` มาถึง ต้องตรงกับ `DEFAULT_FLAGS` ฝั่งเซิร์ฟเวอร์
 * ปล่อยเป็นรายการว่างแปลว่า "ทุกอย่างเปิด" ซึ่งทำให้บล็อกทิปกับแถวบัตรโผล่แว้บหนึ่งแล้วหายไป
 */
const CLOSED_BY_DEFAULT: UnavailablePaymentMethod[] = [
  { method: 'card', gate: 'card_payment' },
];

export function isPayable(method: PaymentMethod, available: PaymentMethod[]): boolean {
  return available.includes(method);
}

/**
 * ทิปเก็บผ่านเกตเวย์เสมอ (product-spec §6.2) จึงเปิดใช้ไม่ได้จนกว่า §11.3 จะได้คำตอบ
 * ใช้ประตูบานเดียวกับบัตร — คำถามที่ยังไม่มีคำตอบข้อเดียว ประตูเดียว
 */
export function useTippingEnabled(): boolean {
  const unavailable = usePaymentStore((s) => s.unavailable);
  return !unavailable.some((u) => u.gate === 'card_payment');
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
  /** ช่องทางที่รู้จักแต่ปิดอยู่ §6.5 สั่งให้โชว์เป็นแถวกดไม่ได้พร้อมเหตุผล ไม่ใช่ซ่อน */
  unavailable: UnavailablePaymentMethod[];
  setMethod: (m: PaymentMethod) => void;
  setAvailable: (list: PaymentMethod[], unavailable?: UnavailablePaymentMethod[]) => void;
};

export const usePaymentStore = create<PaymentState>((set, get) => ({
  method: 'promptpay',
  available: ALWAYS_AVAILABLE,
  unavailable: CLOSED_BY_DEFAULT,

  setMethod(m) {
    if (!isPayable(m, get().available)) return;
    set({ method: m });
  },

  /** ต้องย้ายช่องทางที่ลูกค้าเลือกไว้ด้วยถ้ามันเพิ่งถูกปิด */
  setAvailable(list, unavailable = CLOSED_BY_DEFAULT) {
    const available = list.length > 0 ? list : ALWAYS_AVAILABLE;
    const method = isPayable(get().method, available) ? get().method : available[0]!;
    // ช่องทางที่ใช้ได้ชนะเสมอ เซิร์ฟเวอร์รุ่นเก่าที่ไม่ส่งรายการปิดมาจะทำให้บัตรอยู่สองฝั่งพร้อมกัน
    set({ available, unavailable: unavailable.filter((u) => !available.includes(u.method)), method });
  },
}));
