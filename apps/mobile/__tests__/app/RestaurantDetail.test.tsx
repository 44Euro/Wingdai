import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RestaurantDetailScreen } from '../../src/features/customer/screens/RestaurantDetailScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

beforeAll(async () => {
  await initI18n();
});
beforeEach(() => {
  useCartStore.getState().clear();
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

function render(restaurantId: string, nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <RestaurantDetailScreen
              navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'RestaurantDetail'>['navigation']}
              route={{ key: 'k', name: 'RestaurantDetail', params: { restaurantId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('RestaurantDetailScreen', () => {
  it('เมนูไม่มีตัวเลือก (m-malee-2) กดเพิ่ม → เข้าตะกร้าตรงๆ แถบตะกร้าโผล่', async () => {
    const result = render('r-malee', { navigate: jest.fn() });
    await flush();
    expect(findAll(result.root, 'cart-bar').length).toBe(0);
    act(() => {
      findAll(result.root, 'add-m-malee-2')[0].props.onPress();
    });
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(findAll(result.root, 'cart-bar').length).toBeGreaterThanOrEqual(1);
  });

  it('เมนูมีตัวเลือก (m-malee-1) กดเพิ่ม → navigate ไปหน้า customize (MenuItem)', async () => {
    const navigate = jest.fn();
    const result = render('r-malee', { navigate });
    await flush();
    act(() => {
      findAll(result.root, 'add-m-malee-1')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('MenuItem', { restaurantId: 'r-malee', menuItemId: 'm-malee-1' });
    expect(useCartStore.getState().lines).toHaveLength(0); // ยังไม่เข้าตะกร้าจนกว่าจะเลือกเสร็จ
  });

  it('กดแถบตะกร้า → navigate ไป Cart', async () => {
    const navigate = jest.fn();
    const result = render('r-malee', { navigate });
    await flush();
    act(() => {
      findAll(result.root, 'add-m-malee-2')[0].props.onPress();
    });
    act(() => {
      findAll(result.root, 'cart-bar')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Cart');
  });
});
