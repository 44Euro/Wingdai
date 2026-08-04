import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SlideToConfirm } from '../../src/ui/motion';
import { maxTravel, clampDrag, shouldCommit, COMMIT_RATIO } from '../../src/ui/motion/slideRule';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

/** กติกาของ "เลื่อนเพื่อยืนยัน" (design R3) */
describe('กติกาเลื่อนเพื่อยืนยัน', () => {
  const TRACK = 320;
  const MAX = maxTravel(TRACK, 52, 4);

  it('รางแคบกว่าหัวปุ่ม ขยับไม่ได้เลย ไม่ใช่ค่าติดลบ', () => {
    expect(maxTravel(40, 52, 4)).toBe(0);
  });

  it('ลากเลยรางไปก็ค้างที่ปลาย ไม่หลุดนอกกรอบ', () => {
    expect(clampDrag(9999, MAX)).toBe(MAX);
    expect(clampDrag(-50, MAX)).toBe(0);
  });

  it('ลากไม่ถึงเกณฑ์ ไม่ยืนยัน', () => {
    expect(shouldCommit(MAX * (COMMIT_RATIO - 0.05), MAX)).toBe(false);
  });

  it('ลากถึงเกณฑ์พอดี ยืนยัน', () => {
    expect(shouldCommit(MAX * COMMIT_RATIO, MAX)).toBe(true);
  });

  it('ลากจนสุดราง ยืนยัน', () => {
    expect(shouldCommit(MAX, MAX)).toBe(true);
  });

  /** รางกว้างศูนย์ = จอเพิ่งขึ้นยังไม่ได้ layout แตะเบา ๆ ตอนนั้นต้องไม่กลายเป็นการยืนยัน */
  it('ยังไม่ได้ layout แตะแล้วต้องไม่ยืนยัน', () => {
    expect(shouldCommit(0, 0)).toBe(false);
    expect(shouldCommit(500, 0)).toBe(false);
  });
});

let tree: renderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

function render(props: Partial<React.ComponentProps<typeof SlideToConfirm>> = {}) {
  const onConfirm = jest.fn();
  act(() => {
    tree = renderer.create(
      <ThemeProvider forceScheme="light">
        <SlideToConfirm
          testID="slide"
          label="เลื่อนเพื่อยืนยัน"
          confirmedLabel="กำลังยืนยัน"
          onConfirm={onConfirm}
          {...props}
        />
      </ThemeProvider>,
    );
  });
  return { tree: tree!, onConfirm };
}

/** ตัวที่กดได้คือชั้น `-press` ที่ซ้อนบนราง ไม่ใช่ตัวราง */
function pressNode(t: renderer.ReactTestRenderer) {
  return t.root
    .findAll((n) => n.props?.testID === 'slide-press')
    .find((n) => typeof n.props?.onPress === 'function')!;
}

describe('SlideToConfirm', () => {
  it('ยังไม่แตะ ยังไม่ยืนยัน', () => {
    const { onConfirm } = render();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /** กดปกติก็ยืนยันได้ คนที่ใช้ screen reader ลากนิ้วไม่ได้ ต้องไม่ถูกกันออก */
  it('กดปกติก็ยืนยันได้', () => {
    const { tree: t, onConfirm } = render();
    act(() => {
      pressNode(t).props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ปิดอยู่ กดไม่ได้', () => {
    const { tree: t } = render({ disabled: true });
    expect(pressNode(t).props.disabled).toBe(true);
  });

  it('ยืนยันแล้วกดซ้ำไม่ได้ ป้องกันส่งสองรอบ', () => {
    const { tree: t, onConfirm } = render();
    act(() => {
      pressNode(t).props.onPress();
    });
    expect(pressNode(t).props.disabled).toBe(true);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
