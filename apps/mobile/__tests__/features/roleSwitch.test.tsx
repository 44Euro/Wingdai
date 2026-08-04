import React from 'react';
import renderer, { act } from 'react-test-renderer';
import i18n from 'i18next';
import { RoleSwitcher } from '../../src/app/RoleSwitcher';
import { useAuthStore } from '../../src/features/auth/authStore';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

/** หา node ที่ onPress เรียกได้จริง testID เฉย ๆ จะเจอ composite ด้วย */
function press(tree: renderer.ReactTestRenderer, testID: string) {
  const node = tree.root.findAll(
    (n) => n.props.testID === testID && typeof n.props.onPress === 'function',
  )[0];
  if (!node) throw new Error(`ไม่พบปุ่มที่กดได้: ${testID}`);
  act(() => {
    node.props.onPress();
  });
}

function has(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll((n) => n.props.testID === testID).length > 0;
}

let tree: renderer.ReactTestRenderer | null = null;
function renderSwitcher() {
  act(() => {
    tree = renderer.create(
      <ThemeProvider forceScheme="light">
        <RoleSwitcher />
      </ThemeProvider>,
    );
  });
  return tree!;
}

beforeEach(() => {
  // ไรเดอร์มีสองบทบาท: รับงานส่ง และสั่งอาหารเอง (product-spec §4.3)
  useAuthStore.setState({
    capabilities: ['rider', 'customer'],
    activeCapability: 'rider',
  } as never);
});

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

/** การสลับโหมดย้ายผู้ใช้ข้าม navigation stack ทั้งอัน */
describe('ยืนยันก่อนสลับโหมด', () => {
  it('กดการ์ดครั้งเดียวยังไม่สลับ — โหมดเดิมค้างไว้', () => {
    const t = renderSwitcher();
    press(t, 'role-card-customer');

    expect(useAuthStore.getState().activeCapability).toBe('rider');
    expect(has(t, 'confirm-switch-role')).toBe(true);
  });

  it('กดยืนยันในกล่องแล้วจึงสลับ', () => {
    const t = renderSwitcher();
    press(t, 'role-card-customer');
    press(t, 'confirm-switch-role');

    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('กดยกเลิกแล้วไม่สลับ และกล่องปิดไป', () => {
    const t = renderSwitcher();
    press(t, 'role-card-customer');
    press(t, 'cancel-switch-role');

    expect(useAuthStore.getState().activeCapability).toBe('rider');
    expect(has(t, 'confirm-switch-role')).toBe(false);
  });

  it('กดการ์ดโหมดที่ใช้อยู่แล้ว ไม่ต้องถามยืนยัน', () => {
    const t = renderSwitcher();
    press(t, 'role-card-rider');

    expect(has(t, 'confirm-switch-role')).toBe(false);
    expect(useAuthStore.getState().activeCapability).toBe('rider');
  });

  /** กล่องต้องบอกว่ากำลังจะไปไหน ไม่ใช่ถาม "แน่ใจไหม" ลอย ๆ */
  it('กล่องยืนยันบอกชื่อโหมดปลายทาง', () => {
    const t = renderSwitcher();
    press(t, 'role-card-customer');

    const text = t.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(text).toContain(i18n.t('roleSwitcher.customer'));
  });
});
