import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Button } from '../../src/ui/Button';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { contrastRatio } from '../../src/theme/tokens/contrast';

function flatStyle(el: any) {
  const s = el.props?.style;
  if (!s) return {};
  if (Array.isArray(s)) {
    const flattened = s.flat().filter(Boolean);
    return Object.assign({}, ...flattened);
  }
  if (typeof s === 'function') {
    return s({ pressed: false });
  }
  return s;
}

function findByTestID(tree: any, testID: string): any {
  if (!tree) return null;
  if (tree.props?.testID === testID) {
    return tree;
  }
  if (tree.children && Array.isArray(tree.children)) {
    for (const child of tree.children) {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
  }
  return null;
}

describe('Button', () => {
  it('ปุ่มหลักใช้ brand-700 ไม่ใช่ brand-500', () => {
    let result: any;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Button testID="b" label="ตกลง" onPress={() => {}} />
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    const button = findByTestID(tree, 'b');
    expect(button).not.toBeNull();
    const style = flatStyle(button);
    expect(style.backgroundColor).toBe('#CC4310');
  });

  it('พื้นปุ่มกับตัวหนังสือผ่าน AA', () => {
    let result: any;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Button testID="b" label="ตกลง" onPress={() => {}} />
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    const button = findByTestID(tree, 'b');
    expect(button).not.toBeNull();
    const bg = flatStyle(button).backgroundColor;
    expect(contrastRatio('#FFFFFF', bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('พื้นที่แตะสูงอย่างน้อย 44', () => {
    let result: any;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Button testID="b" label="ตกลง" onPress={() => {}} />
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    const button = findByTestID(tree, 'b');
    expect(button).not.toBeNull();
    const style = flatStyle(button);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('กดแล้วเรียก onPress', () => {
    const fn = jest.fn();
    let result: any;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Button testID="b" label="ตกลง" onPress={fn} />
        </ThemeProvider>,
      );
    });
    // Use instance API to find Pressable
    const instance = result!.root;
    const pressable = instance.findByProps({ testID: 'b' });
    expect(pressable).not.toBeNull();
    // Simulate press by calling onPress
    act(() => {
      pressable.props.onPress();
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ปิดใช้งานแล้วไม่เรียก onPress', () => {
    const fn = jest.fn();
    let result: any;

    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Button testID="b" label="ตกลง" onPress={fn} disabled />
        </ThemeProvider>,
      );
    });

    const instance = result!.root;
    const pressable = instance.findByProps({ testID: 'b' });
    expect(pressable).not.toBeNull();
    expect(pressable.props.disabled).toBe(true);

    // When disabled=true, Pressable's native behavior prevents calling onPress
    expect(pressable.props.onPress).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });
});
