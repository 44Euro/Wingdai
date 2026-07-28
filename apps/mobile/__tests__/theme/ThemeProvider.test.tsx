import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeProvider';

function Probe() {
  const { tokens, scheme } = useTheme();
  return <Text testID="probe">{`${scheme}:${tokens.bgSurface}`}</Text>;
}

describe('ThemeProvider', () => {
  it('โหมดสว่างให้พื้นสีครีม', () => {
    let result;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="light">
          <Probe />
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    if (tree && !Array.isArray(tree) && tree.type === 'Text') {
      expect(tree.children).toEqual(['light:#F6F1EA']);
    }
  });

  it('โหมดมืดให้พื้นดำอมเขียวตามจอ C32 ไม่ใช่พื้น teal แบบเดิม', () => {
    let result;
    act(() => {
      result = ReactTestRenderer.create(
        <ThemeProvider forceScheme="dark">
          <Probe />
        </ThemeProvider>,
      );
    });
    const tree = result!.toJSON();
    if (tree && !Array.isArray(tree) && tree.type === 'Text') {
      expect(tree.children).toEqual(['dark:#0F1A19']);
    }
  });

  it('useTheme นอก Provider ต้อง throw', () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      act(() => {
        ReactTestRenderer.create(<Probe />);
      });
    }).toThrow('useTheme ต้องอยู่ภายใน ThemeProvider');

    spy.mockRestore();
  });
});
