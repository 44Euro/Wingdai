import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { MerchantOrderDetailScreen } from '../../src/features/merchant/screens/MerchantOrderDetailScreen';
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

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function findAny(root: ReactTestRenderer.ReactTestInstance, id: string) {
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

async function placeOrderThenBecomeOwner() {
  let orderId = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 2, choiceIds: ['c-spicy-mid', 'c-egg'] }],
      paymentMethod: 'cash',
    });
    orderId = order.id;
    await useAuthStore.getState().login('malee', '1234');
  });
  return orderId;
}

function render(orderId: string, nav: { goBack: jest.Mock; navigate?: jest.Mock }) {
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
            <MerchantOrderDetailScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'MerchantOrderDetail', params: { orderId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('MerchantOrderDetailScreen — รับ/ปฏิเสธออร์เดอร์', () => {
  it('ออร์เดอร์ใหม่โชว์นาฬิกาใหญ่และปุ่มรับ', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const result = render(orderId, { goBack: jest.fn() });
    await flush();

    expect(findAll(result.root, 'accept-countdown').length).toBe(1);
    expect(findAny(result.root, 'btn-order-next').length).toBeGreaterThanOrEqual(1);
    expect(findAny(result.root, 'btn-order-reject').length).toBeGreaterThanOrEqual(1);
  });

  it('กดรับออร์เดอร์แล้วสถานะเปลี่ยนเป็น accepted และเด้งกลับ', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const goBack = jest.fn();
    const result = render(orderId, { goBack });
    await flush();

    act(() => {
      findAny(result.root, 'btn-order-next')[0].props.onPress();
    });
    await flush();

    expect((await repos.orders.get(orderId))?.status).toBe('accepted');
    expect(goBack).toHaveBeenCalled();
  });

  /** M12 ปุ่มปฏิเสธพาไปถามเหตุผล ไม่ยกเลิกทันที */
  it('กดปฏิเสธแล้วไปจอถามเหตุผล ยังไม่ยกเลิกทันที', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const navigate = jest.fn();
    const result = render(orderId, { goBack: jest.fn(), navigate });
    await flush();

    act(() => {
      findAny(result.root, 'btn-order-reject')[0].props.onPress();
    });
    await flush();

    expect(navigate).toHaveBeenCalledWith('RejectOrder', { orderId });
    expect((await repos.orders.get(orderId))?.status).toBe('created');
  });

  /** ร้านต้องเห็นว่าถูกหักไปเท่าไหร่ ไม่ใช่เห็นแค่ยอดสุทธิ */
  it('แจกแจงค่าอาหาร หักคอมมิชชัน แล้วเหลือเท่าไหร่', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const result = render(orderId, { goBack: jest.fn() });
    await flush();

    const texts = result.root
      .findAll((n) => typeof n.type === 'string' && n.props?.children !== undefined)
      .map((n) => String(n.props.children));

    expect(texts).toContain('฿130'); // ค่าอาหาร
    expect(texts.some((s) => s.includes('฿19.50'))).toBe(true); // คอมมิชชัน 15%
    expect(texts).toContain('฿110.50'); // ร้านได้รับ
  });

  it('ออร์เดอร์ที่ไม่มีอยู่ไม่ทำให้จอพัง', async () => {
    await placeOrderThenBecomeOwner();
    const result = render('ไม่มีจริง', { goBack: jest.fn() });
    await flush();
    expect(findAll(result.root, 'order-missing').length).toBe(1);
  });
});
