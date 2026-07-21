import { contrastRatio } from '../../src/theme/tokens/contrast';
import { primitives } from '../../src/theme/tokens/primitives';

describe('contrastRatio', () => {
  it('สีเดียวกันได้อัตรา 1:1', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('ขาวกับดำได้ 21:1', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('รับค่าที่ไม่มี # นำหน้าได้', () => {
    expect(contrastRatio('FFFFFF', '000000')).toBeCloseTo(21, 1);
  });
});

describe('กฎสีของแบรนด์ Wingdai', () => {
  const { brand, teal, ink, cream, white } = primitives;

  it('teal บนครีมผ่าน AA สำหรับข้อความปกติ', () => {
    expect(contrastRatio(teal[500], cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('ครีมบน teal ผ่าน AA (โหมดมืด)', () => {
    expect(contrastRatio(cream, teal[500])).toBeGreaterThanOrEqual(4.5);
  });

  it('ink บนครีมผ่าน AA — สีข้อความหลัก', () => {
    expect(contrastRatio(ink[100], cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('ขาวบน brand-700 ผ่าน AA — นี่คือสีพื้นปุ่มที่ใช้ได้', () => {
    expect(contrastRatio(white, brand[700])).toBeGreaterThanOrEqual(4.5);
  });

  it('brand-800 บนครีมผ่าน AA — สีตัวอักษร/ลิงก์แบรนด์', () => {
    expect(contrastRatio(brand[800], cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('brand-800 บน brand tint ผ่าน AA — ตัวอักษรในแบดจ์ส้ม', () => {
    expect(contrastRatio(brand[800], brand[50])).toBeGreaterThanOrEqual(4.5);
  });

  // #F15A22 คือสีส้มจริงของ design แต่ contrast ไม่พอสำหรับตัวหนังสือ
  it('ขาวบน brand-500 ไม่ผ่าน AA — กันคนเผลอเอาไปทำพื้นปุ่ม', () => {
    expect(contrastRatio(white, brand[500])).toBeLessThan(4.5);
  });

  it('brand-500 บนครีมไม่ผ่าน AA — กันคนเผลอเอาไปทำข้อความ', () => {
    expect(contrastRatio(brand[500], cream)).toBeLessThan(4.5);
  });

  it('brand-500 ยังผ่านเกณฑ์ non-text 3:1 — ใช้เป็นพื้นไอคอน/เส้นได้', () => {
    expect(contrastRatio(white, brand[500])).toBeGreaterThanOrEqual(3);
  });
});

describe('กฎ lineHeight ภาษาไทย', () => {
  it('lineHeight ทุกระดับต้องไม่ต่ำกว่า 1.7 เท่าของ fontSize', () => {
    const { fontSize, lineHeight } = primitives;
    (Object.keys(fontSize) as Array<keyof typeof fontSize>).forEach((key) => {
      const ratio = lineHeight[key] / fontSize[key];
      expect(ratio).toBeGreaterThanOrEqual(1.7);
    });
  });
});
