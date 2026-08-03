import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CountdownRing, PressScale, AnimatedToggle } from '../../src/ui/motion';

jest.useFakeTimers();

/** หา node ที่ `onPress` เรียกได้จริง */
function press(tree: renderer.ReactTestRenderer, testID: string) {
  const node = tree.root.findAll(
    (n) => n.props.testID === testID && typeof n.props.onPress === 'function',
  )[0];
  if (!node) throw new Error(`ไม่พบปุ่มที่กดได้: ${testID}`);
  act(() => {
    node.props.onPress();
  });
}

describe('motion primitives', () => {
  it('วงแหวนนับถอยหลังเรียก onDone เมื่อครบเวลา', () => {
    const onDone = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <CountdownRing seconds={15} color="#F15A22" trackColor="#EEEEEE" onDone={onDone} />,
      );
    });

    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it('วงแหวนนับถอยหลังหยุดเองตอนถูกถอด ไม่เรียก onDone หลังจากนั้น', () => {
    const onDone = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <CountdownRing seconds={15} color="#F15A22" trackColor="#EEEEEE" onDone={onDone} />,
      );
    });

    act(() => {
      tree.unmount();
    });
    act(() => {
      jest.advanceTimersByTime(20_000);
    });

    expect(onDone).not.toHaveBeenCalled();
  });

  it('PressScale ส่ง onPress ต่อให้ผู้เรียก', () => {
    const onPress = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <PressScale testID="p" onPress={onPress}>
          <></>
        </PressScale>,
      );
    });

    press(tree, 'p');
    expect(onPress).toHaveBeenCalled();

    act(() => {
      tree.unmount();
    });
  });

  it('AnimatedToggle สลับค่าเมื่อกด', () => {
    const onValueChange = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AnimatedToggle
          testID="tg"
          value={false}
          onValueChange={onValueChange}
          onColor="#F15A22"
          offColor="#DDDDDD"
          knobColor="#FFFFFF"
        />,
      );
    });

    press(tree, 'tg');
    expect(onValueChange).toHaveBeenCalledWith(true);

    act(() => {
      tree.unmount();
    });
  });
});
