import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { MerchantSummaryScreen } from '../../src/features/merchant/screens/MerchantSummaryScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';
import { formatBaht } from '../../src/lib/format';

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

/** ลูกค้าสั่งจากร้านของ malee แล้วเดินจนส่งถึง → กลายเป็นยอดขายของร้าน */
async function deliveredOrderAtMalee() {
  let order!: Awaited<ReturnType<typeof repos.orders.create>>;
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 2, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    await repos.orders.updateStatus(order.id, 'accepted');
    await useAuthStore.getState().login('rider_ann', '1234');
    await repos.rider.acceptOffer(order.id);
    await repos.orders.updateStatus(order.id, 'preparing');
    await repos.orders.updateStatus(order.id, 'picked_up');
    await repos.orders.updateStatus(order.id, 'delivered');
    await useAuthStore.getState().login('malee', '1234');
  });
  return order;
}

function render(nav: { goBack: jest.Mock; navigate: jest.Mock }) {
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
            <MerchantSummaryScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'MerchantSummary' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn() });

describe('MerchantSummaryScreen — ยอดขายของร้าน (M1 · M5)', () => {
  it('ร้านที่ยังไม่มียอดขาย แสดงศูนย์ ไม่ใช่จอพัง', async () => {
    await act(async () => {
      await useAuthStore.getState().login('malee', '1234');
    });
    const result = render(nav());
    await flush();

    expect(findAll(result.root, 'screen-merchant-summary').length).toBe(1);
    expect(textOf(result.root, 'sales-today')).toContain(formatBaht(0));
  });

  /**
   * claude.md §6.1 — คอมมิชชัน 15% คิดจากค่าอาหารอย่างเดียว
   * และ §3 หลักการ 2 — ต้องแยกเป็นบรรทัด ไม่ยุบเข้าไปในยอดเดียว
   */
  it('ยอดที่ร้านได้ = ค่าอาหาร − คอมมิชชัน 15%', async () => {
    const order = await deliveredOrderAtMalee();
    const result = render(nav());
    await flush();

    const today = textOf(result.root, 'sales-today');
    const commission = Math.round(order.foodTotal * 0.15);

    expect(today).toContain(formatBaht(order.foodTotal));
    expect(today).toContain(formatBaht(commission));
    expect(today).toContain(formatBaht(order.foodTotal - commission));
  });

  /**
   * ค่าส่งกับค่าบริการไม่ใช่เงินของร้าน — โผล่บนจอนี้เมื่อไหร่ร้านจะคิดว่าตัวเองควรได้ด้วย
   */
  it('ไม่โชว์ค่าส่งและค่าบริการ เพราะไม่ใช่เงินของร้าน', async () => {
    const order = await deliveredOrderAtMalee();
    const result = render(nav());
    await flush();

    const today = textOf(result.root, 'sales-today');
    const gross = order.foodTotal + order.deliveryFee + order.serviceFee;
    expect(today).not.toContain(formatBaht(gross));
    expect(today).not.toContain(formatBaht(order.deliveryFee));
  });

  it('กดจากยอดคิวไปหน้าคิวออร์เดอร์ได้', async () => {
    const n = nav();
    await act(async () => {
      await useAuthStore.getState().login('malee', '1234');
    });
    const result = render(n);
    await flush();

    await act(async () => {
      result.root.findAll((x) => x.props?.testID === 'btn-go-queue')[0].props.onPress();
    });
    expect(n.navigate).toHaveBeenCalledWith('MerchantOrders');
  });
});
