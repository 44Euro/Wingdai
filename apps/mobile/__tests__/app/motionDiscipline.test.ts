import fs from 'node:fs';
import path from 'node:path';

/** จอห้าม import `Animated` เอง ต้องประกอบจาก `src/ui/motion/` */
function screenFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('Screen.tsx')) out.push(full);
    }
  };
  for (const d of ['src/features', 'src/app']) walk(path.resolve(__dirname, '../..', d));
  return out;
}

/** ชื่อที่ import จาก 'react-native' แบบมีวงเล็บปีกกา */
function namedRnImports(src: string): string[] {
  return [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/gs)]
    .flatMap((m) => m[1]!.split(','))
    .map((s) => s.trim().replace(/^type\s+/, ''))
    .filter(Boolean);
}

describe('วินัยเรื่อง animation', () => {
  it('มีไฟล์จอให้ตรวจจริง', () => {
    // กันเคสที่ตัวไล่โฟลเดอร์พังแล้วเทสต์ผ่านเพราะไม่มีอะไรให้ตรวจ
    expect(screenFiles().length).toBeGreaterThan(20);
  });

  it.each(screenFiles().map((f) => [path.basename(f), f] as const))(
    '%s ไม่ import Animated เอง',
    (_name, file) => {
      expect(namedRnImports(fs.readFileSync(file, 'utf8'))).not.toContain('Animated');
    },
  );

  /** ตัวไล่โฟลเดอร์ต้องเจอจอที่รู้ว่ามีอยู่จริง ไม่ใช่เจอแต่ไฟล์อื่น */
  it('สแกนเจอจอของทุกบทบาท', () => {
    const names = screenFiles().map((f) => path.basename(f));
    for (const expected of [
      'RiderHomeScreen.tsx',
      'RiderPickupScreen.tsx',
      'AdminHomeScreen.tsx',
      'OrderTrackingScreen.tsx',
    ]) {
      expect(names).toContain(expected);
    }
  });
});

/** `src/ui/motion/` คือที่เดียวที่แตะ `Animated` ได้ */
describe('animation อยู่ในโฟลเดอร์เดียว', () => {
  function uiFiles(dir: string): string[] {
    const base = path.resolve(__dirname, '../..', dir);
    const out: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(full);
      }
    };
    walk(base);
    return out;
  }

  it('ไฟล์ที่ import Animated อยู่ใน src/ui/motion เท่านั้น', () => {
    const offenders = uiFiles('src')
      .filter((f) => !f.includes(path.join('ui', 'motion')))
      .filter((f) => namedRnImports(fs.readFileSync(f, 'utf8')).includes('Animated'))
      .map((f) => path.relative(path.resolve(__dirname, '../..'), f));

    expect(offenders).toEqual([]);
  });
});
