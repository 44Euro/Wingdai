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
