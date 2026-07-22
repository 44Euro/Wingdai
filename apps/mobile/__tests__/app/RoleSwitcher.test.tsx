import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { RoleSwitcher } from '../../src/app/RoleSwitcher';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/authStore';
import { initI18n } from '../../src/i18n';

// @testing-library/react-native ถูกถอดออกจากโปรเจกต์ (ใช้ไม่ได้กับ jest-expo 57 + React 19)

beforeAll(async () => {
  await initI18n();
});

let currentRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  useAuthStore.setState({
    account: null,
    restaurants: [],
    capabilities: [],
    activeCapability: null,
    isLoading: false,
    error: null,
  });
});

// unmount หลังทุกเทสต์ RoleSwitcher subscribe กับ useAuthStore ซึ่งเป็น store
afterEach(() => {
  act(() => {
    currentRenderer?.unmount();
  });
  currentRenderer = null;
});

/** เรนเดอร์ RoleSwitcher ห่อด้วย ThemeProvider เหมือนเทสต์อื่น ๆ ในโปรเจกต์นี้ */
function wrap(): ReactTestRenderer.ReactTestRenderer {
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <RoleSwitcher />
      </ThemeProvider>,
    );
  });
  return currentRenderer!;
}

/** หา node ทุกตัว (composite + host) ที่มี props.testID ตรงกับที่ระบุ */
function findAllByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
): ReactTestRenderer.ReactTestInstance[] {
  return root.findAll((node) => node.props?.testID === testID);
}

describe('RoleSwitcher', () => {
  it('มี capability เดียวไม่ต้องแสดงตัวสลับ', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const result = wrap();
    expect(findAllByTestId(result.root, 'role-switcher').length).toBe(0);
  });

  it('ไรเดอร์เห็นปุ่มสลับสองปุ่ม', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    const result = wrap();
    expect(findAllByTestId(result.root, 'role-switcher').length).toBeGreaterThanOrEqual(1);
    expect(findAllByTestId(result.root, 'role-card-rider').length).toBeGreaterThanOrEqual(1);
    expect(findAllByTestId(result.root, 'role-card-customer').length).toBeGreaterThanOrEqual(1);
  });

  it('ไม่แสดงปุ่มของ capability ที่ไม่มีสิทธิ์', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    const result = wrap();
    expect(findAllByTestId(result.root, 'role-card-admin').length).toBe(0);
    expect(findAllByTestId(result.root, 'role-card-merchant').length).toBe(0);
  });

  /** กดการ์ดเปิดกล่องยืนยันก่อน ยังไม่สลับทันที (ดูเหตุผลใน __tests__/features/roleSwitch.test.tsx) */
  it('กดปุ่มแล้วยืนยัน จึงเปลี่ยน activeCapability', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    const result = wrap();
    const [customerBtn] = findAllByTestId(result.root, 'role-card-customer');
    expect(customerBtn).toBeDefined();
    act(() => {
      customerBtn.props.onPress();
    });
    expect(useAuthStore.getState().activeCapability).toBe('rider');

    const confirm = result.root
      .findAll((n) => n.props?.testID === 'confirm-switch-role'
        && typeof n.props?.onPress === 'function')[0]!;
    act(() => {
      confirm.props.onPress();
    });
    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('เจ้าของร้านเห็นปุ่มลูกค้าและร้านค้า', async () => {
    await useAuthStore.getState().login('malee', '1234');
    const result = wrap();
    expect(findAllByTestId(result.root, 'role-card-customer').length).toBeGreaterThanOrEqual(1);
    expect(findAllByTestId(result.root, 'role-card-merchant').length).toBeGreaterThanOrEqual(1);
  });
});
