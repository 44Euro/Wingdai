import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import th from '../../src/i18n/locales/th.json';
import en from '../../src/i18n/locales/en.json';

/**
 * เทียบจำนวนคีย์สองภาษาอย่างเดียวจับไม่ได้ว่า "คีย์ที่โค้ดเรียกมีจริงไหม"
 * ของจริงหลุดไปโผล่บนหน้าจอมาแล้วสองแบบ
 *   t('admin.approve')      → คีย์นั้นเป็นออบเจ็กต์ ปุ่มเลยขึ้นข้อความ error ของ i18next ยาวทั้งบรรทัด
 *   t('orderStatus.xxx')    → ไม่มีคีย์นี้เลย แบดจ์เลยโชว์ชื่อคีย์ดิบให้ผู้ใช้เห็น
 */
const SRC = join(__dirname, '../../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

function resolve(dict: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<any>((o, part) => (o == null ? undefined : o[part]), dict);
}

/** เก็บเฉพาะคีย์ที่เขียนตรง ๆ คีย์ที่ประกอบจากตัวแปรตรวจแบบนี้ไม่ได้ */
function literalKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)].map((m) => m[1]!);
}

describe('คีย์ที่โค้ดเรียกต้องมีจริงและเป็นข้อความ', () => {
  const files = walk(SRC);
  const used = new Map<string, string>();
  for (const file of files) {
    for (const key of literalKeys(readFileSync(file, 'utf8'))) {
      if (!used.has(key)) used.set(key, file.replace(SRC, 'src'));
    }
  }

  it('เจอคีย์ที่เขียนตรง ๆ พอสมควร ไม่ใช่ regex พังแล้วผ่านฟรี', () => {
    expect(used.size).toBeGreaterThan(200);
  });

  for (const [dict, name] of [[th, 'ไทย'], [en, 'อังกฤษ']] as const) {
    it(`ทุกคีย์แปลเป็นข้อความได้ในไฟล์${name}`, () => {
      const broken: string[] = [];
      for (const [key, where] of used) {
        const value = resolve(dict as Record<string, unknown>, key);
        if (typeof value !== 'string') {
          broken.push(`${key} (${where}) → ${value === undefined ? 'ไม่มีคีย์นี้' : typeof value}`);
        }
      }
      expect(broken).toEqual([]);
    });
  }
});
