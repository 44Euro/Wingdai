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

/** รวมสไตล์ที่เป็น array หรือซ้อนกันให้เป็นก้อนเดียว */
function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...([style].flat(3).filter(Boolean) as object[]));
}

describe('กรอบเว็บบนจอกว้าง', () => {
  /**
   * เคยพลาดมาแล้ว เปลี่ยนกล่องนอกเป็นแนวนอนโดยยังตั้ง alignItems: 'center' ไว้
   * flex: 1 ของกรอบมือถือเลยไปคุมความกว้างแทนความสูง กรอบยุบเหลือศูนย์และจอดำทั้งใบ
   */
  it('กรอบมือถือยืดเต็มความสูง ไม่ใช่สูงตามเนื้อหา', () => {
    mockSize.width = 1440;
    const tree = mount();
    const [outer] = tree.root.findAll(
      (n) => typeof n.type === 'string' && flat(n.props?.style).flexDirection === 'row',
    );
    expect(outer).toBeDefined();
    expect(flat(outer!.props.style).alignItems).not.toBe('center');
  });

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
