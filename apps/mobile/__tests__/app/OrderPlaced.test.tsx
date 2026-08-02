import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { OrderPlacedScreen } from '../../src/features/customer/screens/OrderPlacedScreen';
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
function press(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = root
    .findAll((n) => n.props?.testID === id)
    .find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error(`ไม่พบปุ่มที่กดได้: ${id}`);
  node.props.onPress();
}
function textOf(root: ReactTestRenderer.ReactTestInstance, id: string): string {
  return findAll(root, id)
    .flatMap((n) => n.findAll((c) => typeof c.type === 'string' && typeof c.props?.children === 'string'))
    .map((n) => String(n.props.children))
    .join(' ');
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render(orderId: string, nav: { popToTop: jest.Mock }) {
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
            <OrderPlacedScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'OrderPlaced', params: { orderId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('OrderPlacedScreen — สั่งสำเร็จ', () => {
  /** เดิมจอนี้เอา `orderId` ซึ่งเป็น uuid มาโชว์ใต้หัวข้อ "เลขที่ออร์เดอร์" */
  it('โชว์เลขที่ออร์เดอร์ที่อ่านออก ไม่ใช่ uuid', async () => {
    let order!: Awaited<ReturnType<typeof repos.orders.create>>;
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
      order = await repos.orders.create({
        restaurantId: 'r-malee',
        items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
        paymentMethod: 'promptpay',
      });
    });

    const result = render(order.id, { popToTop: jest.fn() });
    await flush();

    const shown = textOf(result.root, 'placed-reference');
    expect(shown).toBe(order.reference);
    expect(shown).toMatch(/^WD-/);
    expect(shown).not.toBe(order.id);
  });

  it('กดกลับหน้าแรกแล้วล้าง stack ไม่ให้ย้อนกลับมาจอนี้ได้', async () => {
    let orderId = '';
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
      orderId = (await repos.orders.create({
        restaurantId: 'r-malee',
        items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
        paymentMethod: 'promptpay',
      })).id;
    });

    const nav = { popToTop: jest.fn() };
    const result = render(orderId, nav);
    await flush();

    act(() => {
      press(result.root, 'btn-back-home');
    });
    expect(nav.popToTop).toHaveBeenCalled();
  });
});
