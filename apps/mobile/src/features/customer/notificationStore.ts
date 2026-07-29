import { create } from 'zustand';

type NotificationState = {
  /** ISO string ของเวลาที่กด "อ่านทั้งหมด" ครั้งล่าสุด null = ยังไม่เคยอ่าน */
  lastReadAt: string | null;
  markAllRead: () => void;
};

/** เก็บแค่ "อ่านถึงเมื่อไหร่" ไม่ได้เก็บสถานะรายข้อความ เพราะแจ้งเตือนถูกสร้างจากออร์เดอร์ */
export const useNotificationStore = create<NotificationState>((set) => ({
  lastReadAt: null,
  markAllRead() {
    set({ lastReadAt: new Date().toISOString() });
  },
}));
