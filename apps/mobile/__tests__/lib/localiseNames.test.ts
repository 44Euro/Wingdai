import { localiseNames } from '../../src/lib/localiseNames';

describe('แทนชื่อในคำตอบจาก API ตามภาษาที่ตั้งไว้', () => {
  const shop = { id: '1', name: 'ครัวมาลี', nameEn: 'Malee Kitchen', cuisine: 'rice' };

  it('ภาษาไทยไม่แตะอะไรเลย คืนของเดิมทั้งก้อน', () => {
    expect(localiseNames(shop, 'th')).toBe(shop);
  });

  it('ภาษาอังกฤษแทน name ด้วย nameEn และไม่ทำฟิลด์อื่นหาย', () => {
    const out = localiseNames(shop, 'en') as typeof shop;
    expect(out.name).toBe('Malee Kitchen');
    expect(out.cuisine).toBe('rice');
    expect(out.id).toBe('1');
  });

  it('ทำงานกับรายการและของที่ซ้อนกันหลายชั้น', () => {
    const out = localiseNames({
      orders: [{ restaurantName: 'ครัวมาลี', restaurantNameEn: 'Malee Kitchen',
        items: [{ name: 'ข้าวกะเพราหมู', nameEn: 'Pork Basil Rice' }] }],
    }, 'en') as any;
    expect(out.orders[0].restaurantName).toBe('Malee Kitchen');
    expect(out.orders[0].items[0].name).toBe('Pork Basil Rice');
  });

  /** กลุ่มตัวเลือกฝังอยู่ใน jsonb ของจาน ลึกลงไปสองชั้นจากตัวจาน */
  it('ลงไปถึงชื่อกลุ่มตัวเลือกและชื่อตัวเลือกในจาน', () => {
    const out = localiseNames({
      name: 'ข้าวกะเพราหมูสับ', nameEn: 'Minced Pork Basil Rice',
      optionGroups: [{
        id: 'g-spicy', name: 'ระดับเผ็ด', nameEn: 'Spice level',
        choices: [{ id: 'c1', name: 'เผ็ดมาก', nameEn: 'Extra spicy', priceDelta: 0 }],
      }],
    }, 'en') as any;
    expect(out.optionGroups[0].name).toBe('Spice level');
    expect(out.optionGroups[0].choices[0].name).toBe('Extra spicy');
    expect(out.optionGroups[0].choices[0].priceDelta).toBe(0);
  });

  /** ฟิลด์ชื่อที่ยังไม่มีคู่อังกฤษต้องไม่หายไป ไม่ใช่กลายเป็นว่าง */
  it('ไม่มีคู่อังกฤษก็ปล่อยชื่อเดิมไว้', () => {
    const out = localiseNames({ name: 'ธนาคารกสิกรไทย' }, 'en') as any;
    expect(out.name).toBe('ธนาคารกสิกรไทย');
  });

  it('มีคู่แต่ค่าเป็น null ก็ตกกลับไปใช้ชื่อไทย', () => {
    const out = localiseNames({ customerName: 'สมชาย ใจดี', customerNameEn: null }, 'en') as any;
    expect(out.customerName).toBe('สมชาย ใจดี');
  });

  /** จอแก้โปรไฟล์เอา fullName ไปตั้งต้นในช่องกรอก แปลงแล้วกดบันทึกจะทับชื่อจริงในฐาน */
  it('ห้ามแตะ fullName เด็ดขาด ถึงจะมีคู่อังกฤษก็ตาม', () => {
    const out = localiseNames({ fullName: 'สมชาย ใจดี', fullNameEn: 'Somchai Jaidee' }, 'en') as any;
    expect(out.fullName).toBe('สมชาย ใจดี');
  });

  it('ยังไม่ได้ตั้งภาษา ปล่อยผ่านทั้งก้อน ไม่พัง', () => {
    expect(localiseNames(shop, undefined)).toBe(shop);
    expect(localiseNames(shop, '')).toBe(shop);
  });

  it('ค่าที่ไม่ใช่ออบเจ็กต์ผ่านไปเฉย ๆ ไม่พัง', () => {
    expect(localiseNames(null, 'en')).toBeNull();
    expect(localiseNames('ok', 'en')).toBe('ok');
    expect(localiseNames(7, 'en')).toBe(7);
  });
});
