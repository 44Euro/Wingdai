import { choiceKey, type Choices } from './prefKeys';

/** เหมือน prefs.web — โหมดส่วนตัวของบางเบราว์เซอร์โยน error ตอนแตะ localStorage */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const choice: Choices = {
  async read(k) {
    return storage()?.getItem(choiceKey(k)) ?? null;
  },

  async write(k, value) {
    storage()?.setItem(choiceKey(k), value);
  },
};
