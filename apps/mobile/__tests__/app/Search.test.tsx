import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { SearchScreen } from '../../src/features/customer/screens/SearchScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
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

function render(nav: { navigate: jest.Mock; goBack: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <SearchScreen navigation={nav as never} route={{ key: 'k', name: 'Search' } as never} />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

async function type(result: ReactTestRenderer.ReactTestRenderer, text: string) {
  act(() => {
    findAll(result.root, 'input-search')[0].props.onChangeText(text);
  });
  await flush();
}

describe('SearchScreen (C2)', () => {
  it('ยังไม่พิมพ์อะไร → ขึ้นคำชวนพิมพ์ ไม่ยิงค้นหา', async () => {
    const result = render({ navigate: jest.fn(), goBack: jest.fn() });
    await flush();
    expect(findAll(result.root, 'search-prompt').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'search-results-count').length).toBe(0);
  });

  it('พิมพ์ชื่อร้าน → เจอร้านนั้น', async () => {
    const result = render({ navigate: jest.fn(), goBack: jest.fn() });
    await flush();
    await type(result, 'มาลี');
    expect(findAll(result.root, 'search-result-r-malee').length).toBeGreaterThanOrEqual(1);
  });

  it('พิมพ์คำที่ไม่ตรงอะไรเลย → ขึ้นสถานะไม่พบผลลัพธ์', async () => {
    const result = render({ navigate: jest.fn(), goBack: jest.fn() });
    await flush();
    await type(result, 'zzzzไม่มีจริง');
    expect(findAll(result.root, 'search-empty').length).toBeGreaterThanOrEqual(1);
  });

  it('กดผลลัพธ์ → ไปหน้าร้าน', async () => {
    const navigate = jest.fn();
    const result = render({ navigate, goBack: jest.fn() });
    await flush();
    await type(result, 'มาลี');
    act(() => {
      findAll(result.root, 'search-result-r-malee')[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RestaurantDetail', { restaurantId: 'r-malee' });
  });

  it('กดยกเลิก → กลับหน้าเดิม', async () => {
    const goBack = jest.fn();
    const result = render({ navigate: jest.fn(), goBack });
    await flush();
    act(() => {
      findAll(result.root, 'link-search-cancel')[0].props.onPress();
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
