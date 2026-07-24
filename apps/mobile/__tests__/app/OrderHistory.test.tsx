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
function render() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <OrderHistoryScreen />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('OrderHistoryScreen', () => {
  it('ลูกค้าที่มีออร์เดอร์ → เห็นการ์ดออร์เดอร์', async () => {
    useAuthStore.setState({ account: { id: 'u-somchai' } } as never);
    const order = await repos.orders.create({
      customerId: 'u-somchai',
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500,
      serviceFee: 500,
    });
    const result = render();
    await flush();
    expect(findAll(result.root, `order-${order.id}`).length).toBeGreaterThanOrEqual(1);
  });

  it('ลูกค้าที่ยังไม่มีออร์เดอร์ → empty state', async () => {
    useAuthStore.setState({ account: { id: 'u-nobody' } } as never);
    const result = render();
    await flush();
    expect(findAll(result.root, 'orders-empty').length).toBeGreaterThanOrEqual(1);
  });
});
