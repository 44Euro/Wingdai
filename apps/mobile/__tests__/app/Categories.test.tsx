import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { CategoriesScreen } from '../../src/features/customer/screens/CategoriesScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';

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
        <ThemeProvider>
          <NavigationContainer>
            <CategoriesScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'Categories' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('CategoriesScreen', () => {
  it('แสดงหมวดครบทุกค่าใน CuisineCategory', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    for (const c of ['rice', 'noodle', 'somtam', 'drink', 'dessert']) {
      expect(findAll(result.root, `category-${c}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('กดหมวดแล้วเห็นเฉพาะร้านในหมวดนั้น', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    act(() => {
      findAll(result.root, 'category-rice')[0].props.onPress();
    });
    await flush();
    // r-malee เป็นร้านข้าวที่อนุมัติแล้ว · r-somtam คนละหมวด · r-pending ยังไม่อนุมัติจึงต้องไม่โผล่
    expect(findAll(result.root, 'category-restaurant-r-malee').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'category-restaurant-r-somtam').length).toBe(0);
    expect(findAll(result.root, 'category-restaurant-r-pending').length).toBe(0);
  });

  it('กดร้านในหมวด → navigate ไป RestaurantDetail', async () => {
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    act(() => {
      findAll(result.root, 'category-rice')[0].props.onPress();
    });
    await flush();
    act(() => {
      findAll(result.root, 'category-restaurant-r-malee')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RestaurantDetail', { restaurantId: 'r-malee' });
  });

  it('กดปุ่มล้างหมวดแล้วกลับมาเห็นกริดหมวดเหมือนเดิม', async () => {
    const result = render({ navigate: jest.fn() });
    await flush();
    act(() => {
      findAll(result.root, 'category-rice')[0].props.onPress();
    });
    await flush();
    act(() => {
      findAll(result.root, 'category-clear')[0].props.onPress();
    });
    await flush();
    expect(findAll(result.root, 'category-noodle').length).toBeGreaterThanOrEqual(1);
  });
});
