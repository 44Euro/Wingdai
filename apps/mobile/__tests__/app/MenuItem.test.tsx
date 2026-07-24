import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MenuItemScreen } from '../../src/features/customer/screens/MenuItemScreen';
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
function first(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const n = findAll(root, id);
  if (n.length === 0) throw new Error(`ไม่พบ testID: ${id}`);
  return n[0];
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render(restaurantId: string, menuItemId: string, nav: { goBack: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <MenuItemScreen
              navigation={nav as unknown as NativeStackScreenProps<CustomerStackParamList, 'MenuItem'>['navigation']}
              route={{ key: 'k', name: 'MenuItem', params: { restaurantId, menuItemId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('MenuItemScreen', () => {
  it('กลุ่มบังคับ (ระดับเผ็ด) ยังไม่เลือก → ปุ่มเพิ่มถูก disable; เลือกแล้ว enable', async () => {
    const result = render('r-malee', 'm-malee-1', { goBack: jest.fn() });
    await flush();
    expect(first(result.root, 'btn-add-to-basket').props.disabled).toBe(true);
    act(() => {
      first(result.root, 'choice-c-spicy-high').props.onPress();
    });
    expect(first(result.root, 'btn-add-to-basket').props.disabled).toBeFalsy();
  });

  it('เลือกไข่ดาว (+15) แล้วกดเพิ่ม → line เข้า cart unitPrice 6500 พร้อม option ที่เลือก', async () => {
    const goBack = jest.fn();
    const result = render('r-malee', 'm-malee-1', { goBack });
    await flush();
    act(() => {
      first(result.root, 'choice-c-spicy-high').props.onPress();
    });
    act(() => {
      first(result.root, 'choice-c-egg').props.onPress();
    });
    act(() => {
      first(result.root, 'btn-add-to-basket').props.onPress();
    });
    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].unitPrice).toBe(6500);
    expect(lines[0].selectedChoices.map((c) => c.choiceId).sort()).toEqual(['c-egg', 'c-spicy-high']);
    expect(goBack).toHaveBeenCalled();
  });
});
