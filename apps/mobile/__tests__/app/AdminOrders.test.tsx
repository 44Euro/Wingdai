import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { AdminOrdersScreen } from '../../src/features/admin/screens/AdminOrdersScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [], activeCapability: null,
  } as never);
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});

function findAny(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
/** เฉพาะ host node `findAny` นับทั้ง composite และ host จึงได้เลขคู่เสมอ */
function findHost(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = findAny(root, id).find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error(`ไม่พบสิ่งที่กดได้: ${id}`);
  return node;
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <AdminOrdersScreen />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

/** ลูกค้าสั่งหนึ่งใบแล้วสลับเป็นแอดมิน คืน id ไว้ให้เทสต์อ้างถึงแถวนั้น */
async function placeOrderThenBeAdmin() {
  let orderId = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    orderId = order.id;
    await useAuthStore.getState().login('admin_root', '1234');
  });
  return orderId;
}

describe('AdminOrdersScreen — AD2 จอเฝ้าออร์เดอร์', () => {
  it('ออร์เดอร์ที่เพิ่งสั่งโผล่ในรายการ พร้อมบอกว่ายังไม่มีไรเดอร์', async () => {
    const orderId = await placeOrderThenBeAdmin();
    const result = render();
    await flush();

    expect(findAny(result.root, `admin-order-${orderId}`).length).toBeGreaterThanOrEqual(1);
    // §10 ไม่มีไรเดอร์ต้องอ่านออกว่า "ยังไม่มี" ไม่ใช่ช่องว่างหรือขีด
    const riderCell = findAny(result.root, `admin-order-rider-${orderId}`)[0];
    expect(String(riderCell.props.children)).toContain(i18n.t('admin.orders.noRider'));
  });

  /** ชิปสามตัวที่คืนรายการเดียวกันหมดคือ UI ที่กดแล้วไม่เกิดอะไร */
  it('กดชิปแล้วรายการเปลี่ยนจริง', async () => {
    const orderId = await placeOrderThenBeAdmin();
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'filter-unassigned').props.onPress();
    });
    await flush();
    expect(findAny(result.root, `admin-order-${orderId}`).length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      pressable(result.root, 'filter-delayed').props.onPress();
    });
    await flush();
    expect(findAny(result.root, `admin-order-${orderId}`).length).toBe(0);
  });

  it('ตัวกรองที่ไม่มีผลลัพธ์บอกว่าว่างเพราะอะไร ไม่ใช่จอเปล่า', async () => {
    await placeOrderThenBeAdmin();
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'filter-delayed').props.onPress();
    });
    await flush();

    const empty = findHost(result.root, 'admin-orders-empty');
    expect(empty.length).toBe(1);
    expect(String(empty[0].props.children)).toBe(i18n.t('admin.orders.empty.delayed'));
  });

  it('มีไรเดอร์แล้วหลุดจากตัวกรอง "ยังไม่มีไรเดอร์"', async () => {
    const orderId = await placeOrderThenBeAdmin();

    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
      await repos.rider.setOnline(true, { lat: 13.7802, lng: 100.5432 });
      await repos.orders.updateStatus(orderId, 'accepted');
      await repos.rider.acceptOffer(orderId);
      await useAuthStore.getState().login('admin_root', '1234');
    });

    const result = render();
    await flush();
    await act(async () => {
      pressable(result.root, 'filter-unassigned').props.onPress();
    });
    await flush();

    expect(findAny(result.root, `admin-order-${orderId}`).length).toBe(0);
  });
});
