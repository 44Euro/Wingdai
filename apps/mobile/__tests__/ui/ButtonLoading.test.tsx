import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator } from 'react-native';
import { Button } from '../../src/ui/Button';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function render(node: React.ReactElement) {
  act(() => {
    r = ReactTestRenderer.create(<ThemeProvider forceScheme="light">{node}</ThemeProvider>);
  });
  return r!;
}

describe('Button loading', () => {
  it('ปกติไม่มีตัวหมุน', () => {
    const result = render(<Button testID="b" label="สั่งเลย" onPress={jest.fn()} />);
    expect(result.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('ตอนกำลังรอเซิร์ฟเวอร์ต้องเห็นว่ากดติดแล้ว ไม่ใช่ปุ่มที่ดูเหมือนตายไปเฉย ๆ', () => {
    const result = render(<Button testID="b" label="สั่งเลย" loading onPress={jest.fn()} />);
    expect(result.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('กดซ้ำระหว่างรอไม่ได้ ไม่งั้นสั่งซ้ำสองใบ', () => {
    const onPress = jest.fn();
    const result = render(<Button testID="b" label="สั่งเลย" loading onPress={onPress} />);
    const pressable = result.root.findAll((n) => n.props?.testID === 'b' && n.props?.accessibilityState)[0];
    expect(pressable.props.accessibilityState.disabled).toBe(true);
  });
});
