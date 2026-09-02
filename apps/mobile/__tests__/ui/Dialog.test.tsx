import React from 'react';
import { create, act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Dialog } from '../../src/ui/Dialog';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

function mount(visible = true) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ThemeProvider>
        <Dialog testID="dlg" visible={visible} onClose={() => {}}>
          <Text>เนื้อหา</Text>
        </Dialog>
      </ThemeProvider>,
    );
  });
  return tree;
}

const flat = (s: unknown) => Object.assign({}, ...[s].flat(3).filter(Boolean));

/**
 * Modal ของ react-native-web วาดลง portal ที่รากหน้า ซึ่งอยู่นอกกรอบมือถือของ WebFrame
 * ถ้าไม่คุมความกว้างเอง กล่องจะกว้างเท่าหน้าต่างเบราว์เซอร์ทั้งบาน
 */
describe('ป๊อปอัปต้องไม่กว้างเกินจอโทรศัพท์', () => {
  it('กล่องมี maxWidth ไม่เกินความกว้างกรอบมือถือ', () => {
    const tree = mount();
    const boxes = tree.root
      .findAll((n) => typeof n.type === 'string' && flat(n.props?.style).maxWidth !== undefined)
      .map((n) => flat(n.props.style).maxWidth);
    expect(boxes.length).toBeGreaterThan(0);
    expect(Math.max(...boxes)).toBeLessThanOrEqual(430);
  });

  it('จัดกึ่งกลางแนวนอน ไม่ใช่ชิดซ้ายเต็มความกว้าง', () => {
    const tree = mount();
    const [overlay] = tree.root.findAll(
      (n) => n.props?.testID === 'dlg' && typeof n.type === 'string',
    );
    expect(flat(overlay!.props.style).alignItems).toBe('center');
  });
});
