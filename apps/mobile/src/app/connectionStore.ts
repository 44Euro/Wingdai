import { create } from 'zustand';
import { ApiError } from '../data/http/client';

type ConnectionState = {
  /** คำขอล่าสุดไปไม่ถึงเซิร์ฟเวอร์เลย ไม่ใช่ถึงแล้วถูกปฏิเสธ */
  offline: boolean;
  reconnecting: boolean;
  goOffline: () => void;
  /** `probe` คืน true เมื่อเซิร์ฟเวอร์ตอบแล้ว */
  retry: (probe: () => Promise<boolean>) => Promise<void>;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  offline: false,
  reconnecting: false,

  goOffline() {
    set({ offline: true });
  },

  async retry(probe) {
    set({ reconnecting: true });
    const ok = await probe();
    set({ offline: !ok, reconnecting: false });
  },
}));

/**
 * ด่านเดียวที่ตัดสินว่า error ของคำขอเป็นเรื่อง "เน็ตหลุด"
 * 403/409/500 คือเซิร์ฟเวอร์ตอบแล้ว จอนี้ไม่ควรขึ้นมาบัง (product-spec §9)
 */
export function reportRequestError(error: unknown) {
  if (error instanceof ApiError && error.status === 0) {
    useConnectionStore.getState().goOffline();
  }
}
