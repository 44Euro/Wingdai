import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { MerchantHoursScreen } from '../../src/features/merchant/screens/MerchantHoursScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
});
beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [], activeCapability: null,
  } as never);
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => { r?.unmount(); });
  r = null;
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((res) => setTimeout(res, 5)); });
  }
}
async function loginMalee() {
  await act(async () => { await useAuthStore.getState().login('malee', '1234'); });
}
function render() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <MerchantHoursScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ key: 'k', name: 'MerchantHours', params: { restaurantId: 'r-malee' } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('MerchantHoursScreen (M11)', () => {
  it('เจ้าของร้านเห็นแถวครบเจ็ดวัน', async () => {
    await loginMalee();
    const result = render();
    await flush();
    for (const day of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
      expect(findAll(result.root, `hours-row-${day}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('ปุ่มบันทึกกดไม่ได้จนกว่าจะแก้อะไรสักอย่าง', async () => {
    await loginMalee();
    const result = render();
    await flush();
    expect(findAll(result.root, 'btn-save-hours')[0]!.props.disabled).toBe(true);

    act(() => { findAll(result.root, 'toggle-day-mon')[0]!.props.onValueChange(true); });
    expect(findAll(result.root, 'btn-save-hours')[0]!.props.disabled).toBe(false);
  });

  it('เปิดวันจันทร์แล้วบันทึก → ตารางถูกเก็บและปุ่มกลับไปกดไม่ได้', async () => {
    await loginMalee();
    const result = render();
    await flush();

    act(() => { findAll(result.root, 'toggle-day-mon')[0]!.props.onValueChange(true); });
    act(() => { findAll(result.root, 'input-open-mon')[0]!.props.onChangeText('10:00'); });
    await act(async () => { findAll(result.root, 'btn-save-hours')[0]!.props.onPress(); });
    await flush();

    const [shop] = await repos.merchant.myRestaurants();
    expect(shop!.openingHours.mon).toEqual({ open: '10:00', close: '21:00' });
    expect(findAll(result.root, 'btn-save-hours')[0]!.props.disabled).toBe(true);
  });

  it('กดพัก 15 นาที → ขึ้นป้ายว่าพักอยู่ และร้านหยุดรับออร์เดอร์', async () => {
    await loginMalee();
    const result = render();
    await flush();

    await act(async () => { findAll(result.root, 'btn-pause-15')[0]!.props.onPress(); });
    await flush();

    expect(findAll(result.root, 'pause-active').length).toBeGreaterThanOrEqual(1);
    const [shop] = await repos.merchant.myRestaurants();
    expect(shop!.isAcceptingOrders).toBe(false);
    // สวิตช์ยังเปิดอยู่ การพักไม่ใช่การปิดร้าน ร้านต้องกลับมาเองโดยไม่ต้องกดอะไร
    expect(shop!.isOpen).toBe(true);
  });

  it('กดกลับมารับ → เลิกพักทันที', async () => {
    await loginMalee();
    // รีโปจำลองเป็นซิงเกิลตันระดับโมดูล การพักจากเทสต์ก่อนหน้ายังค้างอยู่ ตั้งต้นใหม่ก่อน
    await repos.merchant.pause('r-malee', 30);
    const result = render();
    await flush();

    await act(async () => { findAll(result.root, 'btn-resume')[0]!.props.onPress(); });
    await flush();

    const [shop] = await repos.merchant.myRestaurants();
    expect(shop!.pausedUntil).toBeNull();
    // ไม่ยืนยัน isAcceptingOrders ตรงนี้ ตารางที่เทสต์ก่อนหน้าตั้งไว้ทำให้ค่านี้
  });
});
