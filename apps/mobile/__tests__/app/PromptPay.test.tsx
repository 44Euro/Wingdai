import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PromptPayScreen } from '../../src/features/customer/screens/PromptPayScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import { usePaymentStore } from '../../src/features/payment/paymentStore';
import { repos } from '../../src/data';
import type { MenuItem } from '../../src/data/types';

const dish = (id: string, price: number): MenuItem => ({
  id, restaurantId: 'r-malee', name: id, price, category: 'rice', isAvailable: true,
});

beforeAll(async () => {
  await initI18n();
});
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('th');
  });
  useCartStore.getState().clear();
  useAuthStore.setState({ account: null } as never);
  usePaymentStore.setState({ method: 'promptpay' });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id)[0];
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((res) => setTimeout(res, 5)); });
  }
}

function render(navigation: { goBack: jest.Mock; replace: jest.Mock } = {
  goBack: jest.fn(), replace: jest.fn(),
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <PromptPayScreen
            navigation={navigation as never}
            route={{ key: 'k', name: 'PromptPay', params: undefined } as never}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('PromptPayScreen', () => {
  it('ตะกร้าว่างแล้วกดจ่าย ต้องบอกเหตุผล ไม่ใช่เงียบไปเฉย ๆ', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account } as never);

    const result = render();
    await flush();

    await act(async () => {
      find(result.root, 'btn-paid').props.onPress();
    });
    await flush();

    expect(find(result.root, 'promptpay-error')).toBeTruthy();
  });

  it('เซิร์ฟเวอร์ปฏิเสธแล้วต้องโชว์เหตุผลจริง ไม่ใช่ข้อความตายตัวที่อาจไม่ตรงเรื่อง', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account } as never);
    useCartStore.getState().addLine('r-malee', {
      menuItem: dish('m-1', 5000), selectedChoices: [], quantity: 1, note: '',
    });

    jest.spyOn(repos.orders, 'create').mockRejectedValueOnce(new Error('ร้านปิดรับออร์เดอร์ชั่วคราว'));

    const result = render();
    await flush();
    await act(async () => {
      find(result.root, 'btn-paid').props.onPress();
    });
    await flush();

    const err = find(result.root, 'promptpay-error');
    expect(err).toBeTruthy();
    const shown = JSON.stringify(err.props.children);
    expect(shown).toContain('ร้านปิดรับออร์เดอร์ชั่วคราว');
    expect(shown).not.toContain('ร้านของตัวเอง');
  });

  it('คิวอาร์หมดอายุแล้วพาไปจอจ่ายไม่สำเร็จ ไม่ใช่ทิ้งไว้กับปุ่มที่กดไม่ได้ (SY4)', async () => {
    jest.useFakeTimers();
    try {
      const navigation = { goBack: jest.fn(), replace: jest.fn() };
      render(navigation);

      await act(async () => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(navigation.replace).toHaveBeenCalledWith('PaymentFailed', undefined);
    } finally {
      jest.useRealTimers();
    }
  });
});
