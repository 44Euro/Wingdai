import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DemoAccounts } from '../../src/features/auth/DemoAccounts';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { MOCK_PASSWORD } from '../../src/data/mock/seed';

beforeAll(async () => {
  await initI18n();
});
// ล็อกภาษาไว้ ไม่งั้นผลขึ้นกับว่าไฟล์เทสต์ไหนรันก่อนแล้วเปลี่ยนภาษาทิ้งไว้
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('th');
  });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function render(node: React.ReactElement) {
  act(() => {
    r = ReactTestRenderer.create(<ThemeProvider forceScheme="light">{node}</ThemeProvider>);
  });
  return r!;
}

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id)[0];
}

describe('DemoAccounts', () => {
  it('ต่อ API จริงแล้วยังโผล่ แต่ต้องไม่เรียกตัวเองว่าข้อมูลจำลอง', () => {
    const result = render(<DemoAccounts mode="live" onPick={jest.fn()} />);
    expect(find(result.root, 'demo-accounts')).toBeTruthy();
    const labels = result.root
      .findAll((n) => typeof n.props?.children === 'string')
      .map((n) => n.props.children as string);
    expect(labels).toContain('บัญชีทดลอง');
    expect(labels).not.toContain('โหมดสาธิต');
  });

  it('รหัสผ่านต่างกันตามโหมด เพราะ seed สองฝั่งตั้งคนละค่า', () => {
    const onPick = jest.fn();
    const live = render(<DemoAccounts mode="live" onPick={onPick} />);
    act(() => {
      find(live.root, 'demo-pick-somchai').props.onPress();
    });
    expect(onPick).toHaveBeenCalledWith('somchai', 'wingdai1234');
    expect(onPick).not.toHaveBeenCalledWith('somchai', MOCK_PASSWORD);
  });

  it('โผล่พร้อมบัญชีครบทั้งสี่บทบาทเมื่ออยู่โหมดสาธิต', () => {
    const result = render(<DemoAccounts mode="demo" onPick={jest.fn()} />);
    expect(find(result.root, 'demo-accounts')).toBeTruthy();
    for (const u of ['somchai', 'rider_ann', 'admin_root', 'super_root']) {
      expect(find(result.root, `demo-pick-${u}`)).toBeTruthy();
    }
  });

  it('กดแล้วส่งทั้งชื่อผู้ใช้และรหัสผ่านกลับไป ไม่ใช่แค่ชื่อผู้ใช้', () => {
    const onPick = jest.fn();
    const result = render(<DemoAccounts mode="demo" onPick={onPick} />);
    act(() => {
      find(result.root, 'demo-pick-admin_root').props.onPress();
    });
    expect(onPick).toHaveBeenCalledWith('admin_root', MOCK_PASSWORD);
  });

  it('ชื่อผู้ใช้ที่โชว์ต้องมาจาก seed จริง ไม่ใช่พิมพ์ค่าซ้ำไว้ในจอ', () => {
    const result = render(<DemoAccounts mode="demo" onPick={jest.fn()} />);
    // ไรเดอร์ที่ยังรออนุมัติไม่ควรถูกเสนอ เพราะกดแล้วเจอจอ "รอตรวจสอบ" ซึ่งดูเหมือนแอปพัง
    expect(result.root.findAll((n) => n.props?.testID === 'demo-pick-rider_new')).toHaveLength(0);
  });
});
