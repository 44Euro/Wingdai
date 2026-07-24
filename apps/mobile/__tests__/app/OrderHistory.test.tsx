import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderHistoryScreen } from '../../src/features/customer/screens/OrderHistoryScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
});
beforeEach(() => {
  useAuthStore.setState({ account: null } as never);
});
let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});
function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}
const navigate = jest.fn();

function render() {
  navigate.mockClear();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <OrderHistoryScreen
            navigation={{ navigate } as never}
            route={{ key: 'k', name: 'Orders' } as never}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('OrderHistoryScreen', () => {
  it('ลูกค้าที่มีออร์เดอร์ → เห็นการ์ดออร์เดอร์', async () => {
    // ต้องล็อกอินผ่าน repo จริง ไม่ใช่ยัด account ลง store ตรง ๆ
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account });
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });
    const result = render();
    await flush();
    expect(findAll(result.root, `order-${order.id}`).length).toBeGreaterThanOrEqual(1);
  });

  /** ออร์เดอร์ที่ยังเดินอยู่ ลูกค้าอยากรู้ว่าอาหารถึงไหน ไม่ใช่อยากดูยอดเงิน */
  it('กดออร์เดอร์ที่ยังไม่จบ → ไปจอติดตาม', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account });
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });
    const result = render();
    await flush();

    const card = result.root.findAll(
      (n) => n.props?.testID === `order-${order.id}` && typeof n.props?.onPress === 'function',
    )[0]!;
    await act(async () => {
      card.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('OrderTracking', { orderId: order.id });
  });

  it('กดออร์เดอร์ที่จบแล้ว → ไปใบเสร็จ', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account });
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });
    for (const st of ['accepted', 'preparing', 'picked_up', 'delivered'] as const) {
      // eslint-disable-next-line no-await-in-loop
      await repos.orders.updateStatus(order.id, st);
    }
    const result = render();
    await flush();

    const card = result.root.findAll(
      (n) => n.props?.testID === `order-${order.id}` && typeof n.props?.onPress === 'function',
    )[0]!;
    await act(async () => {
      card.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Receipt', { orderId: order.id });
  });

  it('ลูกค้าที่ยังไม่มีออร์เดอร์ → empty state', async () => {
    useAuthStore.setState({ account: { id: 'u-nobody' } } as never);
    const result = render();
    await flush();
    expect(findAll(result.root, 'orders-empty').length).toBeGreaterThanOrEqual(1);
  });
});
