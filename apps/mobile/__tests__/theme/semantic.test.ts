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
    });
  });
});
