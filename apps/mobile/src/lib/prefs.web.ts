import { prefKey, type Prefs } from './prefKeys';

/** SSR / ตอน prerender ไม่มี window อย่าให้พังตั้งแต่ import */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // โหมดส่วนตัวของบางเบราว์เซอร์โยน error ตอนแตะ localStorage
    return null;
  }
}

export const prefs: Prefs = {
  async get(k) {
    return storage()?.getItem(prefKey(k)) === '1';
  },

  async mark(k) {
    storage()?.setItem(prefKey(k), '1');
  },
};
