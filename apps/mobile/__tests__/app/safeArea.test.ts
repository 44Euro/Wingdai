import fs from 'node:fs';
import path from 'node:path';

/** ทุกจอที่วาดหัวจอเองต้องกันแถบสถานะ */
const SCREEN_DIRS = ['src/features', 'src/app'];

function screenFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('Screen.tsx')) out.push(full);
    }
  };
  for (const d of SCREEN_DIRS) walk(path.resolve(__dirname, '../..', d));
  return out;
}

describe('จอต้องกันแถบสถานะ', () => {
  it('มีไฟล์จอให้ตรวจจริง', () => {
    expect(screenFiles().length).toBeGreaterThan(20);
  });

  it.each(screenFiles().map((f) => [path.basename(f), f]))(
    '%s ไม่วาดหัวจอทับแถบสถานะ',
    (_name, file) => {
      const src = fs.readFileSync(file, 'utf8');

      /** ตรวจ ทุกจอ ไม่ใช่เฉพาะจอที่ใช้ ScreenHeader */
      /** รับได้สองวิธี: */
      const wrapped = src.includes('SafeAreaView') && /edges=\{\[[^\]]*'top'/.test(src);
      const manual = src.includes('useSafeAreaInsets') && src.includes('insets.top');
      expect(wrapped || manual).toBe(true);
    },
  );
});
