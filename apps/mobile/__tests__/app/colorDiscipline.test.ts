import fs from 'node:fs';
import path from 'node:path';

/**
 * product-spec §10: จอทุกจอประกอบจาก primitive ใน `src/ui/` ห้ามมีสีดิบในไฟล์จอ
 *
 * กฎ animation ไม่หลุดเพราะมีด่านสแกนซอร์สคุมอยู่ ส่วนกฎสีหลุดไปยี่สิบจุดเพราะไม่มี
 * ไฟล์นี้คือด่านคู่กัน แก้ครั้งเดียวแล้วกันทั้งตระกูล ไม่ใช่ไล่แก้ทีละจุดแล้วรอมันไหลกลับ
 */
const ROOT = path.resolve(__dirname, '../..');

/**
 * ข้อยกเว้นที่มีเหตุผลกำกับในโค้ด — สีที่ไม่ได้วางบนพื้นของแอป จึงพลิกตามธีมไม่ได้
 * เพิ่มรายการที่นี่ต้องมีคอมเมนต์ในไฟล์นั้นบอกว่าทำไม ไม่ใช่เพิ่มเพื่อให้เทสต์เขียว
 */
const ALLOWED = new Map<string, string>([
  ['src/features/admin/components/OpsMapView.tsx', 'ขอบหมุดบนไทล์แผนที่ ไม่ใช่บนพื้นแอป'],
  ['src/features/customer/components/TrackingMap.tsx', 'ขอบหมุดบนไทล์แผนที่ ไม่ใช่บนพื้นแอป'],
  ['src/features/customer/screens/PromptPayScreen.tsx', 'โมดูล QR ต้องดำสนิทบนขาวสนิทถึงจะสแกนติด'],
  ['src/app/WebFrame.web.tsx', 'CSS boxShadow ของกรอบมือถือจำลองบนเว็บ อยู่นอกระบบโทเคนของแอป'],
]);

/**
 * ข้อจำกัดที่รู้ตัว: รายการยกเว้นทำงานระดับไฟล์ ไม่ใช่ระดับบรรทัด ไฟล์ในรายการจึงสะสม
 * สีดิบเพิ่มได้โดยด่านไม่เห็น แลกกับความง่ายในการอ่าน — รายการต้องสั้นและมีเหตุผลกำกับทุกบรรทัด
 */

/**
 * จับทั้งอัญประกาศเดี่ยวและคู่ — JSX เขียน `color="#FFFFFF"` ด้วยอัญประกาศคู่
 * ด่านที่จับแค่อัญประกาศเดี่ยวปล่อยสีดิบใน JSX ผ่านหมด ซึ่งเป็นที่ที่มันอยู่เยอะที่สุด
 * และจับ rgba() ด้วย เพราะมันก็คือสีดิบเหมือนกัน แค่เขียนคนละรูป
 */
const hasRawColor = (src: string) =>
  /['"]#[0-9A-Fa-f]{3,8}['"]/.test(src) || /\brgba?\(\s*\d/.test(src);
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

/** เดินเฉพาะชั้นจอ ชั้นโทเคนกับ primitive ของ UI นิยามสีได้ตามนิยาม จึงไม่ถูกเดินตั้งแต่ต้น */
function appFiles(): string[] {
  return [...sourceFiles(path.join('src', 'features')), ...sourceFiles(path.join('src', 'app'))];
}

const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

describe('วินัยเรื่องสี (product-spec §10)', () => {
  it('มีไฟล์ให้ตรวจจริง กันเคสที่ตัวไล่โฟลเดอร์พังแล้วผ่านฟรี', () => {
    expect(appFiles().length).toBeGreaterThan(50);
  });

  it('ไม่มีสีดิบในไฟล์จอ ทั้งอัญประกาศเดี่ยว คู่ และ rgba นอกจากรายการยกเว้น', () => {
    const offenders = appFiles()
      .map(rel)
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => hasRawColor(read(f)));

    expect(offenders).toEqual([]);
  });

  /** รายการยกเว้นต้องยังจำเป็นอยู่ ไฟล์ที่เลิกใช้สีดิบแล้วต้องถูกถอดออกจากรายการ */
  it('ทุกรายการยกเว้นยังมีสีดิบอยู่จริง', () => {
    for (const [file, reason] of ALLOWED) {
      expect({ file, reason, hasRawColor: hasRawColor(read(file)) })
        .toEqual({ file, reason, hasRawColor: true });
    }
  });

  /** ข้อยกเว้นต้องอธิบายตัวเองในโค้ด คนอ่านคนต่อไปจะได้ไม่ยื่นข้อค้นพบเดิมซ้ำ */
  it('ทุกรายการยกเว้นมีคอมเมนต์บอกเหตุผลอยู่ในไฟล์', () => {
    for (const file of ALLOWED.keys()) {
      expect({ file, explained: read(file).includes('ค่าดิบโดยตั้งใจ') })
        .toEqual({ file, explained: true });
    }
  });
});
