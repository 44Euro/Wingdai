import { localName } from '../../src/lib/localName';

describe('ชื่อที่โชว์ตามภาษาที่ตั้งไว้', () => {
  it('ภาษาไทยใช้ชื่อไทยเสมอ ถึงจะมีชื่ออังกฤษก็ตาม', () => {
    expect(localName('ครัวมาลี', 'Malee Kitchen', 'th')).toBe('ครัวมาลี');
  });

  it('ภาษาอังกฤษใช้ชื่ออังกฤษ', () => {
    expect(localName('ครัวมาลี', 'Malee Kitchen', 'en')).toBe('Malee Kitchen');
  });

  /** ร้านที่เจ้าของเพิ่งสมัครยังไม่ได้กรอกชื่ออังกฤษ ปล่อยให้ชื่อหายไปแย่กว่าโชว์ไทย */
  it('ไม่มีชื่ออังกฤษก็ตกกลับไปใช้ชื่อไทย ไม่ใช่ว่างเปล่า', () => {
    expect(localName('ครัวมาลี', null, 'en')).toBe('ครัวมาลี');
    expect(localName('ครัวมาลี', undefined, 'en')).toBe('ครัวมาลี');
    expect(localName('ครัวมาลี', '   ', 'en')).toBe('ครัวมาลี');
  });

  it('รหัสภาษาแบบมีภูมิภาคต่อท้ายก็ยังตัดสินถูก', () => {
    expect(localName('ครัวมาลี', 'Malee Kitchen', 'th-TH')).toBe('ครัวมาลี');
    expect(localName('ครัวมาลี', 'Malee Kitchen', 'en-US')).toBe('Malee Kitchen');
  });
});
