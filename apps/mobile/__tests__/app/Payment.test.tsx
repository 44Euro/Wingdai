import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { PaymentMethodScreen } from '../../src/features/customer/screens/PaymentMethodScreen';
import { PromptPayScreen, formatCountdown } from '../../src/features/customer/screens/PromptPayScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import { usePaymentStore, isPayable } from '../../src/features/payment/paymentStore';
import type { MenuItem } from '../../src/data/types';
import { repos } from '../../src/data';

const item = (id: string, price: number): MenuItem => ({
  id,
  restaurantId: 'r-malee',
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

/**
 * ล็อกอินผ่าน repo จริง ไม่ใช่ยัด account ลง store ตรง ๆ
 *
 * orders.create อ่านว่าใครสั่งจาก repo เหมือนที่เซิร์ฟเวอร์อ่านจาก token
 * — แอปไม่เคยส่ง customerId ไปให้ปลอมได้ การยัด store จึงไม่พอที่จะสั่งของได้
 */
async function signIn(username: string) {
  const account = await repos.auth.login(username, '1234');
  useAuthStore.setState({ account } as never);
  return account;
}

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}

function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = findAll(root, id).find((n) => typeof n.props.onPress === 'function');
  if (!node) throw new Error(`ไม่พบปุ่มกดของ ${id}`);
  return node;
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render(node: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { retry: false, gcTime: 0 } },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>{node}</NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('paymentStore', () => {
  it('ค่าเริ่มต้นคือพร้อมเพย์ ตาม claude.md §3 ข้อ 5', () => {
    expect(usePaymentStore.getState().method).toBe('promptpay');
  });

  it('เลือกเงินสดได้', () => {
    act(() => usePaymentStore.getState().setMethod('cash'));
    expect(usePaymentStore.getState().method).toBe('cash');
  });

  it('เลือกบัตรไม่ได้ เพราะยังไม่ได้เชื่อม payment gateway', () => {
    act(() => usePaymentStore.getState().setMethod('card'));
    expect(usePaymentStore.getState().method).toBe('promptpay');
    expect(isPayable('card')).toBe(false);
  });
});

describe('PaymentMethodScreen (C18)', () => {
  it('กดเงินสด → ช่องทางเริ่มต้นเปลี่ยนเป็นเงินสด', () => {
    const result = render(
      <PaymentMethodScreen navigation={{ goBack: jest.fn() } as never} route={{ key: 'k', name: 'PaymentMethod' } as never} />,
    );
    act(() => {
      pressable(result.root, 'payment-cash').props.onPress();
    });
    expect(usePaymentStore.getState().method).toBe('cash');
  });

  it('แถวบัตรถูกปิดไว้ กดแล้วไม่เปลี่ยนช่องทาง', () => {
    const result = render(
      <PaymentMethodScreen navigation={{ goBack: jest.fn() } as never} route={{ key: 'k', name: 'PaymentMethod' } as never} />,
    );
    expect(pressable(result.root, 'payment-card').props.disabled).toBe(true);
    expect(usePaymentStore.getState().method).toBe('promptpay');
  });
});

describe('formatCountdown', () => {
  it('เติมศูนย์หน้าวินาทีให้ครบสองหลัก', () => {
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(9)).toBe('0:09');
  });

  it('ติดลบไม่ได้', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('PromptPayScreen (C5)', () => {
  it('กด "จ่ายแล้ว" → สร้างออร์เดอร์ แล้ว replace ไป OrderPlaced + ตะกร้าถูกล้าง', async () => {
    await signIn('somchai');
    act(() => {
      useCartStore.getState().addItem('r-malee', item('m-malee-4', 2500));
    });
    const nav = { replace: jest.fn(), goBack: jest.fn() };
    const result = render(
      <PromptPayScreen navigation={nav as never} route={{ key: 'k', name: 'PromptPay' } as never} />,
    );
    act(() => {
      pressable(result.root, 'btn-paid').props.onPress();
    });
    await flush();
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace.mock.calls[0][0]).toBe('OrderPlaced');
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('ตะกร้าว่าง → ปุ่มจ่ายแล้วถูกปิด', () => {
    useAuthStore.setState({ account: { id: 'u-somchai' } } as never);
    const result = render(
      <PromptPayScreen
        navigation={{ replace: jest.fn(), goBack: jest.fn() } as never}
        route={{ key: 'k', name: 'PromptPay' } as never}
      />,
    );
    expect(pressable(result.root, 'btn-paid').props.disabled).toBe(true);
  });
});
