import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { OrderTrackingScreen } from '../../src/features/customer/screens/OrderTrackingScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { repos } from '../../src/data';
import type { Order } from '../../src/data/types';

// แผนที่เป็น native module — ไม่มี bridge ใน react-test-renderer จึง mock ทั้ง component
// นี่คือเหตุผลที่ MapLibre ถูกห่อไว้ในไฟล์เดียว: mock ได้ที่จุดเดียว
jest.mock('../../src/features/customer/components/TrackingMap', () => {
  const { View } = require('react-native');
  return { TrackingMap: () => <View testID="tracking-map" /> };
});

beforeAll(async () => {
  await initI18n();
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
  jest.restoreAllMocks();
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

const order: Order = {
  id: 'o-1',
  customerId: 'u-1',
  restaurantId: 'r-malee',
  status: 'preparing',
  items: [{ menuItemId: 'm-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 2 }],
  foodTotal: 10000,
  deliveryFee: 1500,
  serviceFee: 500,
  paymentMethod: 'promptpay',
  paymentStatus: 'paid',
  createdAt: '2026-07-28T01:00:00.000Z',
};

const navigate = jest.fn();

function render(shown: Order = order) {
  navigate.mockClear();
  jest.spyOn(repos.orders, 'get').mockResolvedValue(shown);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <NavigationContainer>
            <OrderTrackingScreen
              navigation={{ goBack: jest.fn(), navigate } as never}
              route={{ key: 'k', name: 'OrderTracking', params: { orderId: 'o-1' } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('OrderTrackingScreen', () => {
  it('แสดงแผนที่', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-map').length).toBeGreaterThanOrEqual(1);
  });

  it('แสดงสถานะปัจจุบันของออร์เดอร์', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-status').length).toBeGreaterThanOrEqual(1);
  });

  it('แยกยอดเป็น 3 ก้อนตาม claude.md §3 ห้ามรวบเป็นก้อนเดียว', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-food-total').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'tracking-delivery-fee').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'tracking-service-fee').length).toBeGreaterThanOrEqual(1);
  });

  it('แสดงชื่อร้าน', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-restaurant').length).toBeGreaterThanOrEqual(1);
  });
});

/**
 * เคส "สั่งเงินสดไว้แล้วเงินไม่พอ" — ทางออกต้องอยู่ในแอป ไม่ใช่ให้ไรเดอร์ออกเงินแทน
 * เหตุผลเต็มอยู่ที่ canPayNowWithPromptPay ใน src/lib/rules.ts
 */
describe('OrderTrackingScreen — เปลี่ยนไปจ่ายพร้อมเพย์', () => {
  const cashOrder: Order = { ...order, paymentMethod: 'cash', paymentStatus: 'pending' };

  it('ออร์เดอร์เงินสดที่ยังไม่จ่าย เห็นปุ่มเปลี่ยนไปพร้อมเพย์', async () => {
    const result = render(cashOrder);
    await flush();
    expect(findAll(result.root, 'tracking-switch-payment').length).toBeGreaterThanOrEqual(1);
  });

  it('ออร์เดอร์ที่จ่ายพร้อมเพย์แล้วไม่เห็นปุ่มนี้', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'tracking-switch-payment')).toHaveLength(0);
  });

  it('ส่งถึงแล้วไม่เห็นปุ่มนี้ ต่อให้เป็นออร์เดอร์เงินสด', async () => {
    const result = render({ ...cashOrder, status: 'delivered' });
    await flush();
    expect(findAll(result.root, 'tracking-switch-payment')).toHaveLength(0);
  });

  it('กดแล้วพาไปจอ QR พร้อมส่ง orderId ไปด้วย ไม่ใช่จอจ่ายตะกร้าใหม่', async () => {
    const result = render(cashOrder);
    await flush();
    const btn = result.root.findAll(
      (n) => n.props?.testID === 'btn-switch-promptpay' && typeof n.props?.onPress === 'function',
    )[0]!;
    await act(async () => {
      btn.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('PromptPay', { orderId: 'o-1' });
  });
});
