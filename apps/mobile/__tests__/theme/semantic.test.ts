import { semanticLight, semanticDark } from '../../src/theme/tokens';
import { contrastRatio } from '../../src/theme/tokens/contrast';

const modes = [
  ['light', semanticLight],
  ['dark', semanticDark],
] as const;

describe('semantic tokens', () => {
  it('ทั้งสองโหมดมีคีย์ชุดเดียวกันครบ', () => {
    expect(Object.keys(semanticLight).sort()).toEqual(Object.keys(semanticDark).sort());
  });

  modes.forEach(([name, t]) => {
    describe(`โหมด ${name}`, () => {
      it('ข้อความหลักบนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.textPrimary, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความรองบนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.textMuted, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความบนปุ่มแบรนด์ผ่าน AA', () => {
        expect(contrastRatio(t.textOnBrand, t.brandSolid)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความหลักบนพื้นยกระดับผ่าน AA', () => {
        expect(contrastRatio(t.textPrimary, t.bgRaised)).toBeGreaterThanOrEqual(4.5);
      });

      // textFaint ใช้กับเวลา/คำใบ้ ซึ่งยังเป็นตัวหนังสือ เกณฑ์ 4.5 จึงยังบังคับ
      // ต้องผ่านทั้งบนพื้นแอปและบนการ์ด เพราะถูกใช้ทั้งสองที่
      it('ข้อความจางบนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.textFaint, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความจางบนพื้นยกระดับผ่าน AA', () => {
        expect(contrastRatio(t.textFaint, t.bgRaised)).toBeGreaterThanOrEqual(4.5);
      });

      it('ลิงก์สีแบรนด์บนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.brandLink, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ตัวอักษรบนแบดจ์สีแบรนด์ผ่าน AA', () => {
        expect(contrastRatio(t.textOnBrandTint, t.brandTint)).toBeGreaterThanOrEqual(4.5);
      });

      // ป้ายชื่อแท็บอยู่นอกแผ่นรองไอคอน จึงวางบนพื้นแถบ nav โดยตรง = เป็นตัวหนังสือเต็มตัว
      it('ป้ายแท็บที่เลือกอยู่ผ่าน AA บนแถบนำทาง', () => {
        expect(contrastRatio(t.navActive, t.navSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ป้ายแท็บที่ไม่ได้เลือกผ่าน AA บนแถบนำทาง', () => {
        expect(contrastRatio(t.navIdle, t.navSurface)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });
});
