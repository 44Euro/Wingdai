import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderEarningsScreen } from '../../src/features/rider/screens/RiderEarningsScreen';
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

/** ลูกค้าสั่ง → เดินสถานะจนส่งถึง โดยไรเดอร์ ann เป็นคนส่ง */
async function deliveredOrder() {
  let order!: Awaited<ReturnType<typeof repos.orders.create>>;
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'cash',
    });
    await repos.orders.updateStatus(order.id, 'accepted');
    await useAuthStore.getState().login('rider_ann', '1234');
    await repos.rider.acceptOffer(order.id);
    await repos.orders.updateStatus(order.id, 'preparing');
    await repos.orders.updateStatus(order.id, 'picked_up');
    await repos.orders.updateStatus(order.id, 'delivered');
  });
  return order;
}

function render() {
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
            <RiderEarningsScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ key: 'k', name: 'RiderEarnings' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('RiderEarningsScreen — รายได้และประวัติงาน (R4 · R6)', () => {
  it('ยังไม่เคยส่งงาน แสดงว่าว่าง ไม่ใช่แสดงตัวเลขมั่ว', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    const result = render();
    await flush();

    expect(findAll(result.root, 'screen-rider-earnings').length).toBe(1);
    expect(findAll(result.root, 'earnings-empty').length).toBe(1);
    expect(textOf(result.root, 'earnings-total')).toContain(formatBaht(0));
  });

  /**
   * claude.md §6.2 — รายได้ของไรเดอร์คือ **ค่าส่ง** ไม่ใช่ยอดที่ลูกค้าจ่าย
   * เอายอดเต็มมาโชว์เป็นรายได้จะทำให้ไรเดอร์เข้าใจผิดว่าตัวเองได้ค่าอาหารด้วย
   */
  it('ยอดรวมคิดจากค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่ายทั้งใบ', async () => {
    const order = await deliveredOrder();
    const result = render();
    await flush();

    const total = textOf(result.root, 'earnings-total');
    expect(total).toContain(formatBaht(order.deliveryFee));

    const gross = order.foodTotal + order.deliveryFee + order.serviceFee;
    expect(total).not.toContain(formatBaht(gross));
    expect(total).not.toContain(formatBaht(order.foodTotal));
  });

  it('งานที่ส่งแล้วขึ้นในประวัติ พร้อมป้ายว่าเก็บเงินสด', async () => {
    const order = await deliveredOrder();
    const result = render();
    await flush();

    expect(findAll(result.root, `delivery-${order.id}`).length).toBe(1);
    expect(findAll(result.root, 'earnings-empty').length).toBe(0);
    expect(textOf(result.root, `delivery-${order.id}`)).toContain(i18n.t('rider.earnings.paidCash'));
  });

  /**
   * §8 — ยังไม่เคยออนไลน์แปลว่ายัง "ไม่รู้" ค่านี้ ไม่ใช่ทำได้ 0
   * กฎเดียวกับ rating/ระยะทางของร้าน: ไม่รู้ต้องแสดงว่าไม่มี ไม่ใช่เอาเลข 0 มาหลอก
   */
  it('ยังไม่เคยออนไลน์ แสดงงาน/ชั่วโมงเป็นขีด ไม่ใช่ 0', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    const result = render();
    await flush();

    expect(textOf(result.root, 'earnings-per-hour')).toBe('—');
  });
});
