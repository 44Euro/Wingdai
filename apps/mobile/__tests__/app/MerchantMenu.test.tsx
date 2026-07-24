import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { MerchantMenuScreen } from '../../src/features/merchant/screens/MerchantMenuScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';

beforeAll(async () => {
  await initI18n();
});
beforeEach(() => {
  useAuthStore.setState({ account: null, restaurants: [], capabilities: [], activeCapability: null } as never);
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
async function loginMalee() {
  await act(async () => {
    await useAuthStore.getState().login('malee', '1234');
  });
}
function render(nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <MerchantMenuScreen navigation={nav as never} route={{ key: 'k', name: 'MerchantMenu' } as never} />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('MerchantMenuScreen', () => {
  it('เจ้าของร้าน (malee) เห็นเมนูของร้านตัวเอง', async () => {
    await loginMalee();
    const result = render({ navigate: jest.fn() });
    await flush();
    expect(findAll(result.root, 'screen-merchant-menu').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'menu-row-m-malee-1').length).toBeGreaterThanOrEqual(1);
  });

  it('กดเพิ่มเมนู → navigate ไป AddMenuItem พร้อม restaurantId', async () => {
    await loginMalee();
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => {
      findAll(result.root, 'btn-add-menu')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('AddMenuItem', { restaurantId: 'r-malee' });
  });
});
