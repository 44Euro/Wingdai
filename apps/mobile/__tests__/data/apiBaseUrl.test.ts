import { API_BASE_URL } from '../../src/data';

/**
 * เคยพลาดมาแล้วครั้งหนึ่ง ค่านี้เคยมาจาก EXPO_PUBLIC_WINGDAI_API_URL อย่างเดียว
 * บันเดิลที่ deploy อยู่ได้ค่าไปจากแคชของ Metro ในเครื่อง พอ build สะอาดค่าก็หายไปเงียบ ๆ
 * แล้วแอปตกไปโหมดสาธิตถาวรโดยไม่มีอะไรเตือน ทั้งที่เซิร์ฟเวอร์ยังอยู่ดี
 */
describe('ที่อยู่ของ core-api', () => {
  it('มีค่าเสมอ ถึงจะ build โดยไม่ตั้งตัวแปรแวดล้อม', () => {
    expect(process.env.EXPO_PUBLIC_WINGDAI_API_URL).toBeUndefined();
    expect(API_BASE_URL).toMatch(/^https:\/\/\S+\/api$/);
  });
});
