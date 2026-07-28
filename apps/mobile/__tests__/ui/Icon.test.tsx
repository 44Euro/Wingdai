import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { Icon, IconName } from '../../src/ui/Icon';

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});

function renderIcon(name: IconName) {
  act(() => {
    r = ReactTestRenderer.create(<Icon name={name} color="#111111" />);
  });
  return r!;
}

describe('Icon', () => {
  it('ไอคอนแฮมเบอร์เกอร์วาดเส้นออกมาจริง ไม่ใช่ svg เปล่า', () => {
    expect(renderIcon('burger').root.findAllByType(Path).length).toBeGreaterThan(0);
  });

  // กระดิ่ง (inbox) กับชาม (menu) มีอยู่แล้วในคลัง ปุ่มแจ้งเตือนกับแท็บ Menu
  it('กระดิ่งกับชามยังวาดได้ — ปุ่มแจ้งเตือนและแท็บ Menu ใช้ตัวนี้', () => {
    expect(renderIcon('inbox').root.findAllByType(Path).length).toBeGreaterThan(0);
    expect(renderIcon('menu').root.findAllByType(Path).length).toBeGreaterThan(0);
  });
});
