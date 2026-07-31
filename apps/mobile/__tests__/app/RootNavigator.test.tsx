import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from '../../src/app/RootNavigator';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/authStore';
import { initI18n } from '../../src/i18n';

// @testing-library/react-native ถูกถอดออกจากโปรเจกต์ (ใช้ไม่ได้กับ jest-expo 57 + React 19)
// ใช้ react-test-renderer ตรง ๆ ตามรูปแบบใน __tests__/ui/Text.test.tsx และ __tests__/ui/Button.test.tsx แทน

// ตอนยังไม่ล็อกอิน RootNavigator คืน AuthNavigator (native-stack) ซึ่งต้องมี
// NavigationContainer เป็นบรรพบุรุษ ไม่งั้น react-navigation จะ throw ตอน render —
// ห่อไว้ตรงนี้เหมือนที่ App.tsx ห่อจริงตอน runtime (ดู App.tsx)

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
    // เทสต์ตั้ง state เองอยู่แล้ว จึงข้ามขั้นกู้เซสชัน — ของจริง RootNavigator
    // จะไม่วาดอะไรจนกว่าจะรู้ว่ามี token ค้างอยู่ไหม (กันจอ login แวบขึ้นมาแล้วหาย)
    isRestoring: false,
    error: null,
  });
});

// unmount หลังทุกเทสต์ — RootNavigator subscribe กับ useAuthStore ซึ่งเป็น store
// ระดับโมดูล (ทุกเทสต์ใช้ instance เดียวกัน) ถ้าไม่ unmount ผลของ login()/beforeEach
// ในเทสต์ถัดไปจะไปสั่ง re-render ต้นไม้เก่าที่ยัง mount ค้างอยู่แบบไม่ห่อ act(...)
afterEach(() => {
  act(() => {
    currentRenderer?.unmount();
  });
  currentRenderer = null;
});

/** เรนเดอร์ RootNavigator ห่อด้วย ThemeProvider เหมือนเทสต์อื่น ๆ ในโปรเจกต์นี้ */
function renderApp(): ReactTestRenderer.ReactTestRenderer {
  // ห่อ QueryClientProvider เหมือน App.tsx จริง — CustomerStack ใช้ useQuery (useRestaurants)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
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

/** ยืนยันว่ามี node ที่มี testID นี้อยู่จริงอย่างน้อยหนึ่งตัว */
function expectPresent(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  expect(findAllByTestId(root, testID).length).toBeGreaterThanOrEqual(1);
}

/** ยืนยันว่าไม่มี node ที่มี testID นี้อยู่เลย — ใช้ยืนยันว่า "ไม่เห็น stack อื่น" */
function expectAbsent(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  expect(findAllByTestId(root, testID).length).toBe(0);
}

describe('RootNavigator', () => {
  it('ยังไม่ล็อกอินเห็นหน้าเข้าสู่ระบบ', () => {
    const result = renderApp();
    expectPresent(result.root, 'screen-login');
  });

  it('user ธรรมดาเข้า CustomerStack', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const result = renderApp();
    expectPresent(result.root, 'screen-customer-home');
  });

  it('ไรเดอร์ที่อนุมัติแล้วเข้า RiderStack เป็นค่าเริ่มต้น', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    const result = renderApp();
    expectPresent(result.root, 'stack-rider');
  });

  it('ไรเดอร์ที่อนุมัติแล้วสลับไปโหมดลูกค้าได้', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    useAuthStore.getState().setActiveCapability('customer');
    const result = renderApp();
    expectPresent(result.root, 'screen-customer-home');
  });

  it('ไรเดอร์ที่รออนุมัติเห็นหน้ารออนุมัติเท่านั้น ห้ามเห็น stack ใด ๆ เลย', async () => {
    await useAuthStore.getState().login('rider_new', '1234');
    const result = renderApp();
    expectPresent(result.root, 'screen-pending');
    // กฎความปลอดภัย: ไรเดอร์รออนุมัติต้องไม่เข้า stack ใดเลย รวมทั้งการสั่งอาหาร (stack-customer)
    expectAbsent(result.root, 'screen-customer-home');
    expectAbsent(result.root, 'stack-rider');
    expectAbsent(result.root, 'screen-merchant-orders');
    expectAbsent(result.root, 'stack-admin');
  });

  it('เจ้าของร้านเริ่มที่คิวออร์เดอร์ ไม่ใช่จอเมนู', async () => {
    await useAuthStore.getState().login('malee', '1234');
    const result = renderApp();
    // ร้านเปิดแอปเพราะมีออร์เดอร์เข้า ไม่ใช่เพราะอยากแก้เมนู (§8 อัตราการรับออร์เดอร์ > 95%)
    expectPresent(result.root, 'screen-merchant-orders');
    expectAbsent(result.root, 'screen-merchant-menu');
  });

  it('แอดมินเข้า AdminStack', async () => {
    await useAuthStore.getState().login('admin_root', '1234');
    const result = renderApp();
    expectPresent(result.root, 'stack-admin');
  });
});
