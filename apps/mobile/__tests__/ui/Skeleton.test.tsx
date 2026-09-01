import React from 'react';
import { create, act } from 'react-test-renderer';
import { Skeleton, SkeletonCards } from '../../src/ui/motion';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

function mount(node: React.ReactElement) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return tree;
}

function hosts(tree: ReturnType<typeof create>, testID: string) {
  return tree.root.findAll(
    (n) => n.props?.testID === testID && typeof n.type === 'string',
  );
}

describe('Skeleton', () => {
  it('กินพื้นที่ตามที่สั่ง จอจึงไม่กระโดดตอนของจริงมาแทน', () => {
    const tree = mount(<Skeleton testID="sk" height={104} radius={12} />);
    const [box] = hosts(tree, 'sk');
    const style = Object.assign({}, ...[box!.props.style].flat().filter(Boolean));
    expect(style.height).toBe(104);
    expect(style.borderRadius).toBe(12);
  });

  it('โครงการ์ดวาดตามจำนวนที่สั่ง', () => {
    const tree = mount(<SkeletonCards testID="cards" count={3} />);
    expect(hosts(tree, 'cards-0')).toHaveLength(1);
    expect(hosts(tree, 'cards-2')).toHaveLength(1);
    expect(hosts(tree, 'cards-3')).toHaveLength(0);
  });
});
