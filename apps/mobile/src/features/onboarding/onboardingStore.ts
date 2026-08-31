import { create } from 'zustand';
import { prefs } from '../../lib/prefs';

type OnboardingState = {
  /** A6 ทัวร์แนะนำแอป ดูครั้งเดียวตลอดอายุการติดตั้ง */
  introSeen: boolean;
  /** C30 ถามสิทธิ์ครั้งเดียว ปฏิเสธไปแล้วก็ไม่ตามตื๊อ */
  permissionsAsked: boolean;
  /** true จนกว่าจะอ่านค่าจากที่เก็บถาวรเสร็จ กันจอแนะนำแวบขึ้นมาให้คนที่เคยดูแล้ว */
  isLoading: boolean;
  load: () => Promise<void>;
  completeIntro: () => void;
  completePermissions: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  introSeen: false,
  permissionsAsked: false,
  isLoading: true,

  async load() {
    const [introSeen, permissionsAsked] = await Promise.all([
      prefs.get('introSeen'),
      prefs.get('permissionsAsked'),
    ]);
    set({ introSeen, permissionsAsked, isLoading: false });
  },

  // เขียนลงที่เก็บถาวรแบบไม่รอ จอถัดไปไม่ควรค้างรอ I/O ที่ล้มเหลวก็ไม่เป็นไร
  completeIntro() {
    set({ introSeen: true });
    void prefs.mark('introSeen');
  },

  completePermissions() {
    set({ permissionsAsked: true });
    void prefs.mark('permissionsAsked');
  },
}));
