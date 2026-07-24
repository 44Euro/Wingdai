import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CartScreen } from '../../src/features/customer/screens/CartScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useCartStore } from '../../src/features/cart/cartStore';
import type { MenuItem } from '../../src/data/types';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

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

function render(nav: { navigate: jest.Mock }) {
  act(() => {
    r = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <NavigationContainer>
          <CartScreen
            navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'Cart'>['navigation']}
            route={{ key: 'k', name: 'Cart' } as never}
          />
        </NavigationContainer>
      </ThemeProvider>,
    );
  });
  return r!;
}

describe('CartScreen', () => {
  it('ตะกร้าว่างแสดง empty state', () => {
    const result = render({ navigate: jest.fn() });
    expect(findAll(result.root, 'cart-empty').length).toBeGreaterThanOrEqual(1);
  });

  it('เพิ่มจำนวนแล้วยอดรวมอัปเดต และกดสั่งเลย → navigate Checkout', () => {
    act(() => {
      useCartStore.getState().addItem('r-malee', item('m1', 5000));
    });
    const navigate = jest.fn();
    const result = render({ navigate });
    act(() => {
      findAll(result.root, 'qty-inc-m1')[0].props.onPress();
    });
    expect(useCartStore.getState().lines[0].quantity).toBe(2);
    act(() => {
      findAll(result.root, 'btn-place-order')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Checkout');
  });
});
