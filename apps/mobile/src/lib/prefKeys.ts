/** ธงที่ตอบว่า "เคยผ่านขั้นนี้ไปแล้วหรือยัง" ต้องอยู่ข้ามการเปิดแอป */
export type PrefKey = 'introSeen' | 'permissionsAsked';

export const prefKey = (k: PrefKey) => `wingdai.pref.${k}`;

export type Prefs = {
  get(k: PrefKey): Promise<boolean>;
  mark(k: PrefKey): Promise<void>;
};
