/** ธงที่ตอบว่า "เคยผ่านขั้นนี้ไปแล้วหรือยัง" ต้องอยู่ข้ามการเปิดแอป */
export type PrefKey = 'introSeen' | 'permissionsAsked';

export const prefKey = (k: PrefKey) => `wingdai.pref.${k}`;

export type Prefs = {
  get(k: PrefKey): Promise<boolean>;
  mark(k: PrefKey): Promise<void>;
};

/** ตัวเลือกที่ผู้ใช้ตั้งเอง เก็บเป็นค่าจริง ไม่ใช่ธงเปิดปิดแบบ PrefKey */
export type ChoiceKey = 'language';

export const choiceKey = (k: ChoiceKey) => `wingdai.choice.${k}`;

export type Choices = {
  read(k: ChoiceKey): Promise<string | null>;
  write(k: ChoiceKey, value: string): Promise<void>;
};
