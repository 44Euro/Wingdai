import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WingdaiTabBar } from '../../src/app/navigators/WingdaiTabBar';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import * as hooks from '../../src/features/customer/hooks';
import type { Order } from '../../src/data/types';

beforeAll(async () => {
  await initI18n();
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
  useCartStore.getState().clear();
  jest.restoreAllMocks();
});

// Pressable ส่ง testID ต่อลงไปยัง host component ลูกด้วย โหนดที่ตรงจึงมีได้มากกว่าหนึ่ง
// เช็คว่า "มี" ด้วย >= 1 และเช็คว่า "ไม่มี" ด้วย === 0 (แบบเดียวกับเทสต์จออื่นใน repo)
function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}

const ROUTE_NAMES = ['CustomerHome', 'Categories', 'Orders', 'Profile'] as const;

const activeOrder: Order = {
  id: 'o-1',
  customerId: 'u-1',
  restaurantId: 'r-malee',
  status: 'preparing',
  items: [{ menuItemId: 'm-1', name: 'ข้าวกะเพรา', unitPrice: 5000, quantity: 1 }],
  foodTotal: 5000,
  deliveryFee: 1500,
  serviceFee: 500,
  createdAt: '2026-07-28T01:00:00.000Z',
};

function fillCart(quantity: number) {
  act(() => {
    useCartStore.setState({
      restaurantId: 'r-malee',
      lines: [
        {
          lineId: 'm-1',
          menuItemId: 'm-1',
          name: 'ข้าวกะเพรา',
          basePrice: 5000,
          selectedChoices: [],
          unitPrice: 5000,
          quantity,
        },
      ],
    });
  });
}

function render(parentNavigate = jest.fn()) {
  const state = {
    index: 0,
    routes: ROUTE_NAMES.map((name, i) => ({ key: `${name}-${i}`, name })),
  };
  const descriptors = Object.fromEntries(
    state.routes.map((route) => [route.key, { options: { title: route.name } }]),
  );
  const navigation = {
    navigate: jest.fn(),
    emit: () => ({ defaultPrevented: false }),
    getParent: () => ({ navigate: parentNavigate }),
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <WingdaiTabBar
            state={state as never}
            descriptors={descriptors as never}
            navigation={navigation as never}
            insets={{ top: 0, right: 0, bottom: 0, left: 0 }}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('WingdaiTabBar', () => {
  it('เวลาปกติเห็นแค่ 4 แท็บ ไม่มีปุ่มลอยเลย', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(undefined);
    const result = render();
    for (const name of ROUTE_NAMES) {
      expect(findAll(result.root, `tab-${name}`).length).toBeGreaterThanOrEqual(1);
    }
    expect(findAll(result.root, 'tab-order').length).toBe(0);
    expect(findAll(result.root, 'tab-cart').length).toBe(0);
  });

  it('มีออร์เดอร์ที่ยังไม่จบ → ปุ่มแฮมเบอร์เกอร์กลางโผล่ กดแล้วไปจอติดตามพร้อม orderId', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(activeOrder);
    const parentNavigate = jest.fn();
    const result = render(parentNavigate);
    expect(findAll(result.root, 'tab-order').length).toBeGreaterThanOrEqual(1);
    act(() => {
      findAll(result.root, 'tab-order')[0].props.onPress();
    });
    expect(parentNavigate).toHaveBeenCalledWith('OrderTracking', { orderId: 'o-1' });
  });

  it('ออร์เดอร์จบแล้ว → ปุ่มแฮมเบอร์เกอร์หายไป', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(undefined);
    expect(findAll(render().root, 'tab-order').length).toBe(0);
  });

  it('มีของในตะกร้า → ปุ่มตะกร้ามุมขวาโผล่พร้อมจำนวนชิ้น กดแล้วไปจอตะกร้า', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(undefined);
    fillCart(2);
    const parentNavigate = jest.fn();
    const result = render(parentNavigate);
    expect(findAll(result.root, 'tab-cart').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'tab-cart-count')[0].props.children).toBe(2);
    act(() => {
      findAll(result.root, 'tab-cart')[0].props.onPress();
    });
    expect(parentNavigate).toHaveBeenCalledWith('Cart');
  });

  it('มีทั้งออร์เดอร์และของในตะกร้า → โผล่พร้อมกันทั้งสองปุ่ม', () => {
    jest.spyOn(hooks, 'useActiveOrder').mockReturnValue(activeOrder);
    fillCart(1);
    const result = render();
    expect(findAll(result.root, 'tab-order').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'tab-cart').length).toBeGreaterThanOrEqual(1);
  });
});
