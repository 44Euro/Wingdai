import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckoutScreen } from '../../src/features/customer/screens/CheckoutScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import { usePaymentStore } from '../../src/features/payment/paymentStore';
import type { MenuItem } from '../../src/data/types';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

const item = (id: string, price: number, rid = 'r-malee'): MenuItem => ({
  id,
  restaurantId: rid,
  name: id,
  price,
  category: 'rice',
  isAvailable: true,
});
beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});
beforeEach(() => {
  useCartStore.getState().clear();
  useAuthStore.setState({ account: null } as never);
  usePaymentStore.setState({ method: 'promptpay' });
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

function render(nav: { navigate: jest.Mock; replace: jest.Mock; popToTop: jest.Mock }) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { retry: false, gcTime: 0 } },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <CheckoutScreen
              navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'Checkout'>['navigation']}
              route={{ key: 'k', name: 'Checkout' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('CheckoutScreen (C17)', () => {
  // พร้อมเพย์ต้องสแกนก่อน จอนี้จึงพาไปจอ QR ไม่ใช่สร้างออร์เดอร์เอง
  it('จ่ายด้วยพร้อมเพย์ → ไปจอ QR ยังไม่สร้างออร์เดอร์', async () => {
    useAuthStore.setState({ account: { id: 'u-somchai' } } as never);
    act(() => {
      useCartStore.getState().addItem('r-malee', item('m-malee-1', 5000));
    });
    const nav = { navigate: jest.fn(), replace: jest.fn(), popToTop: jest.fn() };
    const result = render(nav);
    act(() => {
      findAll(result.root, 'btn-place-order')[0].props.onPress();
    });
    await flush();
    expect(nav.navigate).toHaveBeenCalledWith('PromptPay');
    expect(nav.replace).not.toHaveBeenCalled();
    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  it('จ่ายเงินสด → สร้างออร์เดอร์เลยแล้ว replace ไป OrderPlaced + ตะกร้าถูกล้าง', async () => {
    useAuthStore.setState({ account: { id: 'u-somchai' } } as never);
    usePaymentStore.setState({ method: 'cash' });
    act(() => {
      useCartStore.getState().addItem('r-malee', item('m-malee-1', 5000));
    });
    const nav = { navigate: jest.fn(), replace: jest.fn(), popToTop: jest.fn() };
    const result = render(nav);
    act(() => {
      findAll(result.root, 'btn-place-order')[0].props.onPress();
    });
    await flush();
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace.mock.calls[0][0]).toBe('OrderPlaced');
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('เจ้าของร้านสั่งร้านตัวเอง (เงินสด) → error โชว์ ไม่ replace', async () => {
    useAuthStore.setState({ account: { id: 'u-malee' } } as never);
    usePaymentStore.setState({ method: 'cash' });
    act(() => {
      useCartStore.getState().addItem('r-malee', item('m-malee-1', 5000));
    });
    const nav = { navigate: jest.fn(), replace: jest.fn(), popToTop: jest.fn() };
    const result = render(nav);
    act(() => {
      findAll(result.root, 'btn-place-order')[0].props.onPress();
    });
    await flush();
    expect(nav.replace).not.toHaveBeenCalled();
    const err = findAll(result.root, 'checkout-error').find((n) => typeof n.props.children === 'string');
    expect(err?.props.children).toBe(i18n.t('order.error.ownRestaurant'));
  });

  it('กดแถวช่องทางจ่ายเงิน → ไปจอเลือกช่องทาง (C18)', async () => {
    useAuthStore.setState({ account: { id: 'u-somchai' } } as never);
    act(() => {
      useCartStore.getState().addItem('r-malee', item('m-malee-1', 5000));
    });
    const nav = { navigate: jest.fn(), replace: jest.fn(), popToTop: jest.fn() };
    const result = render(nav);
    act(() => {
      findAll(result.root, 'row-payment')[0].props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('PaymentMethod');
  });
});
