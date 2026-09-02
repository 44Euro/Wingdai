import React from 'react';
import { create, act } from 'react-test-renderer';
import { Input } from '../../src/ui/Field';
import { Card } from '../../src/ui/Surface';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

function render(node: React.ReactNode, scheme: 'light' | 'dark') {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<ThemeProvider forceScheme={scheme}>{node}</ThemeProvider>);
  });
  return tree;
}

const flat = (s: unknown) => Object.assign({}, ...[s].flat(3).filter(Boolean));

function inputStyle(scheme: 'light' | 'dark') {
  const tree = render(<Input testID="fld" />, scheme);
  const [el] = tree.root.findAll((n) => n.props?.testID === 'fld' && typeof n.type === 'string');
  return flat(el!.props.style);
}

function cardStyle(scheme: 'light' | 'dark') {
  const tree = render(<Card testID="crd"><></></Card>, scheme);
  const [el] = tree.root.findAll((n) => n.props?.testID === 'crd' && typeof n.type === 'string');
  return flat(el!.props.style);
}

/**
 * ช่องกรอกเคยใช้พื้นสีเดียวกับการ์ดที่มันวางอยู่ข้างใน และขอบตอนไม่ได้โฟกัสเป็น transparent
 * โหมดสว่างยังเห็นได้จากเงา แต่โหมดมืดเงาเป็นสีดำจางบนพื้นมืด ช่องจึงหายไปทั้งช่อง
 */
describe('ช่องกรอกต้องมีขอบให้ตาจับ', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`โหมด${scheme === 'dark' ? 'มืด' : 'สว่าง'} — ขอบตอนไม่โฟกัสต้องไม่ใช่ transparent`, () => {
      const s = inputStyle(scheme);
      expect(s.borderColor).toBeTruthy();
      expect(s.borderColor).not.toBe('transparent');
      expect(s.borderWidth).toBeGreaterThan(0);
    });

    it(`โหมด${scheme === 'dark' ? 'มืด' : 'สว่าง'} — พื้นช่องต้องต่างจากพื้นการ์ดที่มันอยู่ข้างใน`, () => {
      expect(inputStyle(scheme).backgroundColor).not.toBe(cardStyle(scheme).backgroundColor);
    });
  }
});
