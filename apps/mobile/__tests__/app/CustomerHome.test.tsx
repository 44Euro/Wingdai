import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CustomerHomeScreen } from '../../src/features/customer/screens/CustomerHomeScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import type { CustomerStackParamList } from '../../src/app/navigators/CustomerStack';

beforeAll(async () => {
  await initI18n();
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

function render(nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <CustomerHomeScreen navigation={nav as never} route={{ key: 'k', name: 'CustomerHome' } as never} />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('CustomerHomeScreen', () => {
  it('แสดงร้าน approved และซ่อนร้านที่ยังไม่อนุมัติ', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    expect(findAll(result.root, 'restaurant-card-r-malee').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'restaurant-card-r-somtam').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'restaurant-card-r-pending').length).toBe(0);
  });

  it('กดการ์ดร้าน → navigate ไป RestaurantDetail พร้อม restaurantId', async () => {
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => {
      findAll(result.root, 'restaurant-card-r-malee')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RestaurantDetail', { restaurantId: 'r-malee' });
  });

  // C1 หัวจอมีสามอย่างที่กดได้ — ทุกปุ่มต้องพาไปที่ที่มีจอจริงรออยู่
  it('กดแถบค้นหา → ไปจอค้นหา (C2)', async () => {
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => {
      findAll(result.root, 'btn-search')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Search');
  });

  it('กดกระดิ่ง → ไปจอแจ้งเตือน', async () => {
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => {
      findAll(result.root, 'btn-notifications')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Notifications');
  });

  it('กด "ดูทั้งหมด" → ไปแท็บหมวดหมู่', async () => {
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => {
      findAll(result.root, 'link-see-all')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Categories');
  });
});
