import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { CustomerHomeScreen } from '../../src/features/customer/screens/CustomerHomeScreen';
import { SearchScreen } from '../../src/features/customer/screens/SearchScreen';
import { CategoriesScreen } from '../../src/features/customer/screens/CategoriesScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';

/** ร้านที่ปิดอยู่ต้องอ่านออกว่าปิด ทุกจอที่วาดรายการร้าน ไม่ใช่แค่จอแรก */
const CLOSED_ID = 'r-closed';

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

function render(node: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <NavigationContainer>{node}</NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

/** ข้อความทั้งหมดที่อยู่ใต้การ์ดใบนั้น หาป้ายโดยไม่ผูกกับโครงสร้างของแต่ละจอ */
function textsUnder(card: ReactTestRenderer.ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestRenderer.ReactTestInstance | string) => {
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    n.children?.forEach(walk);
  };
  card.children?.forEach(walk);
  return out;
}

/** มีป้าย "ปิด" อยู่บนการ์ดไหม */
function hasClosedLabel(card: ReactTestRenderer.ReactTestInstance): boolean {
  const label = i18n.t('customer.home.closed');
  return textsUnder(card)
    .flatMap((s) => s.split('·').map((part) => part.trim()))
    .includes(label);
}

/** การ์ดถูกหรี่ลง `opacity` ของ Pressable เป็นฟังก์ชันของ `pressed` */
function dimmed(card: ReactTestRenderer.ReactTestInstance): boolean {
  const style = typeof card.props.style === 'function'
    ? card.props.style({ pressed: false })
    : card.props.style;
  const flat = (Array.isArray(style) ? style : [style]).filter(Boolean);
  return flat.some((s: { opacity?: number }) => typeof s?.opacity === 'number' && s.opacity < 1);
}

describe('ร้านที่ปิดอยู่ต้องอ่านออกว่าปิด ทุกจอที่วาดรายการร้าน', () => {
  it('จอแรก (C1)', async () => {
    const result = render(
      <CustomerHomeScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'k', name: 'CustomerHome' } as never}
      />,
    );
    await flush();

    const card = findAll(result.root, `restaurant-card-${CLOSED_ID}`)[0]!;
    expect(dimmed(card)).toBe(true);
    expect(hasClosedLabel(card)).toBe(true);
  });

  it('จอค้นหา (C2)', async () => {
    const result = render(
      <SearchScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn() } as never}
        route={{ key: 'k', name: 'Search' } as never}
      />,
    );
    await flush();
    act(() => {
      findAll(result.root, 'input-search')[0]!.props.onChangeText('ก๋วยเตี๋ยว');
    });
    await flush();

    const card = findAll(result.root, `search-result-${CLOSED_ID}`)[0]!;
    expect(dimmed(card)).toBe(true);
    expect(hasClosedLabel(card)).toBe(true);
  });

  it('จอหมวดหมู่', async () => {
    const result = render(
      <CategoriesScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'k', name: 'Categories' } as never}
      />,
    );
    await flush();
    act(() => {
      findAll(result.root, 'category-noodle')[0]!.props.onPress();
    });
    await flush();

    const card = findAll(result.root, `category-restaurant-${CLOSED_ID}`)[0]!;
    expect(dimmed(card)).toBe(true);
    expect(hasClosedLabel(card)).toBe(true);
  });

  /** ร้านที่เปิดอยู่ต้องไม่ถูกหรี่ ไม่งั้นเทสต์ข้างบนผ่านได้ด้วยการหรี่ทุกใบ */
  it('ร้านที่เปิดอยู่ไม่ถูกหรี่และไม่ขึ้นว่าปิด', async () => {
    const result = render(
      <CustomerHomeScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'k', name: 'CustomerHome' } as never}
      />,
    );
    await flush();

    const card = findAll(result.root, 'restaurant-card-r-malee')[0]!;
    expect(dimmed(card)).toBe(false);
    expect(hasClosedLabel(card)).toBe(false);
  });
});
