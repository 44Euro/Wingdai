import { semanticLight, semanticDark } from '../../src/theme/tokens';
import { contrastRatio, relativeLuminance } from '../../src/theme/tokens/contrast';

/** ความสว่างที่ตาคนรับรู้ (CIE L*) 0 = ดำ 100 = ขาว */
function lightness(hex: string): number {
  const y = relativeLuminance(hex);
  return y <= 216 / 24389 ? y * (24389 / 27) : Math.cbrt(y) * 116 - 16;
}

/** ช่วงห่างระหว่างช่องสีที่มากที่สุด ยิ่งน้อยยิ่งเป็นเทากลาง */
function channelSpread(hex: string): number {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(...ch) - Math.min(...ch);
}

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
      it('ข้อความจางบนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.textFaint, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความจางบนพื้นยกระดับผ่าน AA', () => {
        expect(contrastRatio(t.textFaint, t.bgRaised)).toBeGreaterThanOrEqual(4.5);
      });

      it('ลิงก์สีแบรนด์บนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.brandLink, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      // บรรทัดรองบนการ์ด teal (การ์ดประกาศหน้าแรก) จางลงได้แต่ยังเป็นตัวหนังสือ
      it('ข้อความรองบนการ์ด teal ผ่าน AA', () => {
        expect(contrastRatio(t.textOnTealMuted, t.tealSolid)).toBeGreaterThanOrEqual(4.5);
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

      /**
       * contrast ratio วัดเรื่องนี้ไม่ได้ พื้นผิวมืดสองชั้นที่ตาแยกออกชัด ๆ ยังได้แค่ ~1.2
       * เพราะพจน์ +0.05 ในสูตร ต้องวัดด้วย L* ซึ่งเป็นความสว่างที่ตาคนรับรู้จริง
       */
      it('การ์ดต้องแยกออกจากพื้นแอปด้วยตาเปล่า', () => {
        expect(lightness(t.bgRaised) - lightness(t.bgSurface)).toBeGreaterThanOrEqual(4);
      });

    });
  });

  // โหมดสว่างให้ร่องในเป็นสีครีมเท่าพื้นแอปโดยตั้งใจ เพราะร่องไปอยู่บนการ์ดขาว ไม่ได้อยู่บนพื้น
  it('ร่องในของโหมดมืดต้องจมกว่าพื้นแอป ไม่ใช่สีเดียวกัน', () => {
    expect(lightness(semanticDark.bgSurface)).toBeGreaterThan(lightness(semanticDark.bgSunken));
  });

  /** teal เป็นสีของแบรนด์ ไม่ใช่สีของพื้น พื้นที่อมเขียวทั้งจออ่านแล้วขุ่น */
  it('พื้นผิวของโหมดมืดต้องเป็นเทากลาง', () => {
    for (const hex of [semanticDark.bgSurface, semanticDark.bgRaised, semanticDark.navSurface]) {
      expect(channelSpread(hex)).toBeLessThanOrEqual(6);
    }
  });
});
