import { formatBaht } from '../../src/lib/format';

describe('formatBaht', () => {
  it('สตางค์ลงตัวเป็นบาทไม่มีทศนิยม', () => {
    expect(formatBaht(5000)).toBe('฿50');
  });
  it('มีเศษสตางค์แสดง 2 ตำแหน่ง', () => {
    expect(formatBaht(1250)).toBe('฿12.50');
  });
  it('ศูนย์', () => {
    expect(formatBaht(0)).toBe('฿0');
  });
});
