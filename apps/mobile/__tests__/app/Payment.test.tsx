import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { PaymentMethodScreen } from '../../src/features/customer/screens/PaymentMethodScreen';
import { PromptPayScreen, formatCountdown } from '../../src/features/customer/screens/PromptPayScreen';
import { CardPayScreen } from '../../src/features/customer/screens/CardPayScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import { usePaymentStore, isPayable } from '../../src/features/payment/paymentStore';
import type { MenuItem } from '../../src/data/types';
import { repos } from '../../src/data';
import { createMockRepos } from '../../src/data/mock';

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
  // ตั้งกลับเป็นสถานะก่อนได้ค่าจากเซิร์ฟเวอร์ทุกครั้ง เทสต์ที่เปิดบัตรต้องไม่รั่วไปเทสต์อื่น
  usePaymentStore.setState({ method: 'promptpay', available: ['promptpay', 'cash'] });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});

/** ล็อกอินผ่าน repo จริง ไม่ใช่ยัด account ลง store ตรง ๆ */
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
  it('ค่าเริ่มต้นคือพร้อมเพย์ ตาม product-spec §3 ข้อ 5', () => {
    expect(usePaymentStore.getState().method).toBe('promptpay');
  });

  it('เลือกเงินสดได้', () => {
    act(() => usePaymentStore.getState().setMethod('cash'));
    expect(usePaymentStore.getState().method).toBe('cash');
  });

  /** ช่องทางที่เลือกได้มาจากเซิร์ฟเวอร์ (`GET /config`) ไม่ใช่รายการตายตัวในแอป */
  it('เลือกช่องทางที่เซิร์ฟเวอร์ยังไม่เปิดไม่ได้', () => {
    act(() => usePaymentStore.getState().setMethod('card'));
    expect(usePaymentStore.getState().method).toBe('promptpay');
    expect(isPayable('card', usePaymentStore.getState().available)).toBe(false);
  });

  it('เซิร์ฟเวอร์เปิดบัตรแล้วเลือกได้', () => {
    act(() => usePaymentStore.getState().setAvailable(['promptpay', 'cash', 'card']));
    act(() => usePaymentStore.getState().setMethod('card'));
    expect(usePaymentStore.getState().method).toBe('card');
  });

  /** กันเคสที่เจ็บจริง: ลูกค้าตั้งเงินสดไว้ แล้วแอดมินปิดเงินสด */
  it('ช่องทางที่เลือกไว้ถูกปิด → ย้ายไปช่องทางที่ใช้ได้เอง', () => {
    act(() => usePaymentStore.getState().setMethod('cash'));
    expect(usePaymentStore.getState().method).toBe('cash');

    act(() => usePaymentStore.getState().setAvailable(['promptpay']));
    expect(usePaymentStore.getState().method).toBe('promptpay');
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

  /**
   * §6.5 "listed in the picker but not selectable yet, labelled payment gateway pending"
   * ซ่อนทิ้งไปเลยทำให้ลูกค้าอ่านว่าแอปไม่รองรับบัตร ทั้งที่มันแค่ยังไม่เปิด
   */
  it('ช่องทางที่เซิร์ฟเวอร์ปิดอยู่ยังโผล่ แต่กดไม่ได้และบอกเหตุผล', () => {
    act(() => usePaymentStore.getState().setAvailable(
      ['promptpay', 'cash'],
      [{ method: 'card', gate: 'card_payment' }],
    ));
    const result = render(
      <PaymentMethodScreen navigation={{ goBack: jest.fn() } as never} route={{ key: 'k', name: 'PaymentMethod' } as never} />,
    );

    const row = pressable(result.root, 'payment-card');
    expect(row.props.disabled).toBe(true);
    expect(findAll(result.root, 'payment-card-reason').length).toBeGreaterThan(0);
    expect(findAll(result.root, 'payment-promptpay').length).toBeGreaterThan(0);
  });

  /** ปุ่มที่กดไม่ได้ต้องไม่เปลี่ยนค่าจริง ๆ ไม่ใช่แค่ดูจาง */
  it('กดแถวที่ปิดอยู่แล้วช่องทางเริ่มต้นไม่เปลี่ยน', () => {
    act(() => usePaymentStore.getState().setAvailable(
      ['promptpay', 'cash'],
      [{ method: 'card', gate: 'card_payment' }],
    ));
    const result = render(
      <PaymentMethodScreen navigation={{ goBack: jest.fn() } as never} route={{ key: 'k', name: 'PaymentMethod' } as never} />,
    );

    act(() => {
      pressable(result.root, 'payment-card').props.onPress();
    });
    expect(usePaymentStore.getState().method).toBe('promptpay');
  });

  it('เซิร์ฟเวอร์เปิดบัตร → แถวบัตรโผล่และกดเลือกได้', () => {
    act(() => usePaymentStore.getState().setAvailable(['promptpay', 'cash', 'card']));
    const result = render(
      <PaymentMethodScreen navigation={{ goBack: jest.fn() } as never} route={{ key: 'k', name: 'PaymentMethod' } as never} />,
    );
    act(() => {
      pressable(result.root, 'payment-card').props.onPress();
    });
    expect(usePaymentStore.getState().method).toBe('card');
  });
});

describe('CardPayScreen', () => {
  it('กดจ่าย → สร้างออร์เดอร์ แล้ว replace ไป OrderPlaced + ตะกร้าถูกล้าง', async () => {
    await signIn('somchai');
    act(() => {
      useCartStore.getState().addItem('r-malee', item('m-malee-4', 2500));
    });
    const nav = { replace: jest.fn(), goBack: jest.fn() };
    const result = render(
      <CardPayScreen navigation={nav as never} route={{ key: 'k', name: 'CardPay' } as never} />,
    );
    act(() => {
      pressable(result.root, 'btn-card-pay').props.onPress();
    });
    await flush();
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace.mock.calls[0][0]).toBe('OrderPlaced');
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  /** เกตเวย์จริงรับเลขบัตรใน SDK ของเขา แอปเราไม่เคยเห็นเลขบัตร */
  it('ไม่มีช่องกรอกเลขบัตร', () => {
    const result = render(
      <CardPayScreen
        navigation={{ replace: jest.fn(), goBack: jest.fn() } as never}
        route={{ key: 'k', name: 'CardPay' } as never}
      />,
    );
    // ช่องกรอกในโปรเจกต์นี้ดูจาก onChangeText (เทสต์จออื่นก็หาช่องกรอกด้วยวิธีนี้)
    const inputs = result.root.findAll((n) => typeof n.props?.onChangeText === 'function');
    expect(inputs).toHaveLength(0);
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

/**
 * โหมดข้อมูลจำลองคือสิ่งที่ URL สาธารณะถอยมาใช้ตอน API ล่ม ค่าตั้งต้นของมันจึงต้องตรง
 * กับ `DEFAULT_FLAGS` ฝั่งเซิร์ฟเวอร์ ไม่งั้นเดโมขายด้วยบัตรได้ทั้งที่ §11.3 ยังไม่ได้คำตอบ
 */
describe('ค่าตั้งต้นของโหมดข้อมูลจำลอง', () => {
  it('บัตรปิดอยู่ และโผล่ในรายการที่ใช้ไม่ได้พร้อมเหตุผล', async () => {
    const config = await createMockRepos().config.get();

    expect(config.paymentMethods).not.toContain('card');
    expect(config.unavailablePaymentMethods).toContainEqual({
      method: 'card',
      gate: 'card_payment',
    });
  });

  it('พร้อมเพย์กับเงินสดยังใช้ได้ ไม่ได้ปิดไปด้วยกัน', async () => {
    const config = await createMockRepos().config.get();
    expect(config.paymentMethods).toEqual(['promptpay', 'cash']);
  });
});
