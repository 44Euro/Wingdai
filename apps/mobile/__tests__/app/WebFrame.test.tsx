import React from 'react';
import { Text as RNText } from 'react-native';
import { create, act } from 'react-test-renderer';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { WebFrame } from '../../src/app/WebFrame.web';

const mockSize = { width: 1440 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockSize.width, height: 900, scale: 1, fontScale: 1 }),
}));

function mount() {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ThemeProvider>
        <WebFrame><RNText>แอป</RNText></WebFrame>
      </ThemeProvider>,
    );
  });
  return tree;
}

function has(tree: ReturnType<typeof create>, testID: string) {
  return tree.root.findAll((n) => n.props?.testID === testID && typeof n.type === 'string').length > 0;
}

describe('กรอบเว็บบนจอกว้าง', () => {
  it('จอแล็ปท็อปมีแผงแนะนำข้างกรอบมือถือ ไม่ใช่พื้นโล่ง', () => {
    mockSize.width = 1440;
    expect(has(mount(), 'web-aside')).toBe(true);
  });

  it('จอแคบไม่มีแผงนั้น แอปกินเต็มความกว้างเหมือนเดิม', () => {
    mockSize.width = 420;
    expect(has(mount(), 'web-aside')).toBe(false);
  });

  it('จอขนาดแท็บเล็ตยังไม่ขึ้นแผง พื้นที่ไม่พอวางสองคอลัมน์', () => {
    mockSize.width = 900;
    expect(has(mount(), 'web-aside')).toBe(false);
  });
});
