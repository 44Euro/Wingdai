import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from '../../src/ui/Text';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

function flatStyle(el: any) {
  const s = el.style || el.props?.style;
  return Array.isArray(s) ? Object.assign({}, ...s.flat().filter(Boolean)) : s;
}

describe('Text', () => {
  it('ปิด font scaling เสมอ', () => {
    let result;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Text testID="t">สวัสดี</Text>
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    expect(tree?.props.allowFontScaling).toBe(false);
  });

  it('lineHeight ไม่ต่ำกว่า 1.7 เท่าของ fontSize ทุก variant', () => {
    const variants = ['display', 'h1', 'h2', 'h3', 'bodyLg', 'body', 'small', 'caption'] as const;
    variants.forEach((v) => {
      let result;
      act(() => {
        result = ReactTestRenderer.create(
          <ThemeProvider forceScheme="light">
            <Text testID={`t-${v}`} variant={v}>ก</Text>
          </ThemeProvider>,
        );
      });
      const tree = result!.toJSON();
      const style = flatStyle(tree);
      expect(style.lineHeight / style.fontSize).toBeGreaterThanOrEqual(1.7);
    });
  });

  it('ไม่มี letterSpacing ติดลบ', () => {
    let result;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Text testID="t">ก</Text>
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    const style = flatStyle(tree);
    if (style.letterSpacing !== undefined) {
      expect(style.letterSpacing).toBeGreaterThanOrEqual(0);
    }
  });

  it('สีข้อความเปลี่ยนตามโหมด', () => {
    let result;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Text testID="t">ก</Text>
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    expect(flatStyle(tree).color).toBe('#1B1917');

    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="dark">
          <Text testID="t2">ก</Text>
        </ThemeProvider>,
      );
    });
    const tree2 = result!.toJSON();
    expect(flatStyle(tree2).color).toBe('#F4F1EC');
  });

  it('color="brand" ใช้ brand-800 (ผ่าน AA) ไม่ใช่ brand-500', () => {
    let result;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Text testID="t" color="brand">ก</Text>
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    expect(flatStyle(tree).color).toBe('#B23A0C');
  });
});
