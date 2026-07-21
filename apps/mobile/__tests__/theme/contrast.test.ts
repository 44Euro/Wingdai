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
  const { brand, teal900, cream, white } = primitives;

  it('teal บนครีมผ่าน AA สำหรับข้อความปกติ', () => {
    expect(contrastRatio(teal900, cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('ครีมบน teal ผ่าน AA (โหมดมืด)', () => {
    expect(contrastRatio(cream, teal900)).toBeGreaterThanOrEqual(4.5);
  });

  it('ขาวบน brand-700 ผ่าน AA — นี่คือสีปุ่มที่ใช้ได้', () => {
    expect(contrastRatio(white, brand[700])).toBeGreaterThanOrEqual(4.5);
  });

  it('brand-700 บนครีมผ่าน AA — สีข้อความแบรนด์', () => {
    expect(contrastRatio(brand[700], cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('ขาวบน brand-500 ไม่ผ่าน AA — กันคนเผลอเอาไปทำปุ่ม', () => {
    expect(contrastRatio(white, brand[500])).toBeLessThan(4.5);
  });

  it('brand-500 บนครีมไม่ผ่าน AA — กันคนเผลอเอาไปทำข้อความ', () => {
    expect(contrastRatio(brand[500], cream)).toBeLessThan(4.5);
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
