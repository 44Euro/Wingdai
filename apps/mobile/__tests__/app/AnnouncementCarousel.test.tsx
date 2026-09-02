import React from 'react';
import { create, act } from 'react-test-renderer';
import { AnnouncementCarousel } from '../../src/features/customer/components/AnnouncementCarousel';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

function mount() {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ThemeProvider><AnnouncementCarousel restaurantCount={19} /></ThemeProvider>,
    );
  });
  return tree;
}

function hosts(tree: ReturnType<typeof create>, testID: string) {
  return tree.root.findAll((n) => n.props?.testID === testID && typeof n.type === 'string');
}

describe('แบนเนอร์ประกาศแบบสไลด์', () => {
  it('มีสามใบ', () => {
    const tree = mount();
    for (const i of [0, 1, 2]) expect(hosts(tree, `banner-slide-${i}`)).toHaveLength(1);
    expect(hosts(tree, 'banner-slide-3')).toHaveLength(0);
  });

  it('มีจุดบอกตำแหน่งครบทุกใบ และกดข้ามได้', () => {
    const tree = mount();
    const [dot] = tree.root.findAll(
      (n) => n.props?.testID === 'banner-dot-2' && typeof n.props?.onPress === 'function',
    );
    expect(dot).toBeDefined();
    act(() => dot!.props.onPress());
  });

  it('จุดของใบปัจจุบันกว้างกว่า ไม่ได้แยกด้วยสีอย่างเดียว', () => {
    const tree = mount();
    const width = (id: string) => {
      const [el] = hosts(tree, id);
      return Object.assign({}, ...[el!.props.style].flat(3).filter(Boolean)).width;
    };
    expect(width('banner-dot-0')).toBeGreaterThan(width('banner-dot-1'));
  });
});

/**
 * บนเว็บ useWindowDimensions คืนความกว้างของหน้าต่างเบราว์เซอร์ ไม่ใช่ของกรอบมือถือ
 * การ์ดจึงกว้างเกินกรอบ และใบถัดไปโผล่มาชิดขอบแบบไม่มีช่องไฟคั่น
 */
describe('ขนาดสไลด์ต้องพอดีกรอบและไม่ติดกัน', () => {
  function laidOut(width: number) {
    const tree = mount();
    const [outer] = hosts(tree, 'home-banner-frame');
    act(() => outer!.props.onLayout({ nativeEvent: { layout: { width } } }));
    return tree;
  }

  const flat = (s: unknown) => Object.assign({}, ...[s].flat(3).filter(Boolean));

  it('สไลด์กว้างไม่เกินกรอบที่วัดได้จริง ไม่ได้อิงความกว้างหน้าต่าง', () => {
    const tree = laidOut(390);
    const slide = flat(hosts(tree, 'banner-slide-0')[0]!.props.style);
    expect(slide.width).toBeLessThanOrEqual(390);
    expect(slide.width).toBeGreaterThan(0);
  });

  it('มีช่องไฟคั่นระหว่างใบ ใบสุดท้ายไม่ต้องมี', () => {
    const tree = laidOut(390);
    const gap = flat(hosts(tree, 'banner-slide-0')[0]!.props.style).marginRight;
    expect(gap).toBeGreaterThan(0);
    expect(flat(hosts(tree, 'banner-slide-2')[0]!.props.style).marginRight).toBe(0);
  });

  it('ระยะ snap ต้องเท่ากับความกว้างใบบวกช่องไฟ ไม่งั้นเลื่อนแล้วค้างคร่อมสองใบ', () => {
    const tree = laidOut(390);
    const [list] = hosts(tree, 'home-banner');
    const slide = flat(hosts(tree, 'banner-slide-0')[0]!.props.style);
    expect(list!.props.snapToInterval).toBe(slide.width + slide.marginRight);
  });
});
