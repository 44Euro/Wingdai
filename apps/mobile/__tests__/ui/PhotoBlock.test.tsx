import React from 'react';
import { Image } from 'react-native';
import { create, act } from 'react-test-renderer';
import { PhotoBlock } from '../../src/ui/Surface';
import { ThemeProvider } from '../../src/theme/ThemeProvider';


function mount(node: React.ReactElement) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return tree;
}

describe('PhotoBlock', () => {
  it('ไม่มี uri ก็ยังวาดกล่องไล่สีเหมือนเดิม ไม่ใช่ช่องว่าง', () => {
    const tree = mount(<PhotoBlock size={64} />);
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
  });

  it('มี uri แล้ววาดรูปทับ', () => {
    const uri = 'https://example.test/dish.jpg';
    const tree = mount(<PhotoBlock size={64} uri={uri} />);
    const [image] = tree.root.findAllByType(Image);
    expect(image.props.source).toEqual({ uri });
  });

  it('รูปโหลดไม่ขึ้นก็ถอยกลับไปกล่องไล่สี ไม่ค้างเป็นกรอบเปล่า', () => {
    const tree = mount(<PhotoBlock size={64} uri="https://example.test/gone.jpg" />);
    const [image] = tree.root.findAllByType(Image);
    act(() => image.props.onError());
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
  });
});
