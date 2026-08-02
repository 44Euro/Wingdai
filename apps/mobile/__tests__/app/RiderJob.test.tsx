import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderJobScreen } from '../../src/features/rider/screens/RiderJobScreen';
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
let client: QueryClient | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  client?.clear();
  client = null;
  r = null;
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function press(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = root
    .findAll((n) => n.props?.testID === id)
    .find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error(`ไม่พบปุ่มที่กดได้: ${id}`);
  node.props.onPress();
}
function screenText(root: ReactTestRenderer.ReactTestInstance): string {
  return root
    .findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string')
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

/** ลูกค้าสั่ง → ร้านรับ → ไรเดอร์รับงาน · คืนออร์เดอร์ที่อยู่สถานะ accepted */
async function jobInProgress(paymentMethod: 'cash' | 'promptpay' = 'cash') {
  let order!: Awaited<ReturnType<typeof repos.orders.create>>;
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 2, choiceIds: ['c-spicy-mid'] }],
      paymentMethod,
    });
    await repos.orders.updateStatus(order.id, 'accepted');
    await useAuthStore.getState().login('rider_ann', '1234');
    await repos.rider.acceptOffer(order.id);
  });
  return order;
}

function render(orderId: string, nav: { goBack: jest.Mock }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  act(() => {
    r?.unmount();
  });
  client?.clear();
  client = qc;
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <RiderJobScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'RiderJob', params: { orderId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const nav = () => ({ goBack: jest.fn() });

describe('RiderJobScreen — งานที่กำลังทำ (R2)', () => {
  /**
   * ครัวยังไม่เริ่มทำ = กดรับของไม่ได้ (orders/stateMachine.ts)
   * ปุ่มต้องหายไปพร้อมบอกเหตุผล ไม่ใช่ปล่อยให้กดแล้วเด้ง error ที่อ่านไม่รู้เรื่อง
   */
  it('ร้านยังไม่เริ่มทำอาหาร ยังไม่มีปุ่มรับของ', async () => {
    const order = await jobInProgress();
    const result = render(order.id, nav());
    await flush();

    expect(findAll(result.root, 'screen-rider-job').length).toBe(1);
    expect(findAll(result.root, 'btn-job-next').length).toBe(0);
    expect(findAll(result.root, 'job-waiting-kitchen').length).toBe(1);
  });

  it('ร้านเริ่มทำแล้ว กดรับของได้ แล้วปุ่มเปลี่ยนเป็นส่งถึง', async () => {
    const order = await jobInProgress();
    await act(async () => {
      await repos.orders.updateStatus(order.id, 'preparing');
    });

    const result = render(order.id, nav());
    await flush();
    expect(findAll(result.root, 'btn-job-next').length).toBe(1);

    await act(async () => {
      press(result.root, 'btn-job-next');
    });
    await flush();

    expect((await repos.orders.get(order.id))?.status).toBe('picked_up');
    expect(screenText(result.root)).toContain(i18n.t('rider.job.action.delivered'));
  });

  /**
   * claude.md §6.2 — ไรเดอร์เก็บ "ยอดเต็มใบ" ไม่ใช่แค่ค่าส่ง
   * เพราะค่าอาหารเป็นเงินของบริษัทที่ต้องส่งต่อให้ร้าน ไรเดอร์ไม่เคยออกเงินเอง
   */
  it('งานเงินสดบอกยอดที่ต้องเก็บเป็นยอดเต็มใบ ไม่ใช่ค่าส่ง', async () => {
    const order = await jobInProgress('cash');
    const result = render(order.id, nav());
    await flush();

    const gross = order.foodTotal + order.deliveryFee + order.serviceFee;
    expect(findAll(result.root, 'job-collect-cash').length).toBe(1);
    expect(screenText(result.root)).toContain(formatBaht(gross));
  });

  it('งานพร้อมเพย์บอกว่าจ่ายแล้ว ไม่มีกล่องเก็บเงิน', async () => {
    const order = await jobInProgress('promptpay');
    const result = render(order.id, nav());
    await flush();

    expect(findAll(result.root, 'job-already-paid').length).toBe(1);
    expect(findAll(result.root, 'job-collect-cash').length).toBe(0);
  });

  /**
   * §6.5 — ลูกค้าที่สั่งเงินสดแล้วเงินไม่พอ เปลี่ยนไปจ่ายพร้อมเพย์กลางทางได้
   * พอเปลี่ยนแล้วหน้าที่เก็บเงินของไรเดอร์ต้องหายทันที ไม่ใช่ค้างอยู่จนไรเดอร์เก็บซ้ำ
   */
  it('ลูกค้าเปลี่ยนไปจ่ายพร้อมเพย์กลางทาง หน้าที่เก็บเงินหายทันที', async () => {
    const order = await jobInProgress('cash');
    const before = render(order.id, nav());
    await flush();
    expect(findAll(before.root, 'job-collect-cash').length).toBe(1);

    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
      await repos.orders.payWithPromptPay(order.id);
      await useAuthStore.getState().login('rider_ann', '1234');
    });

    const after = render(order.id, nav());
    await flush();
    expect(findAll(after.root, 'job-collect-cash').length).toBe(0);
    expect(findAll(after.root, 'job-already-paid').length).toBe(1);
  });

  it('ส่งถึงแล้วเด้งกลับจอก่อนหน้า', async () => {
    const order = await jobInProgress();
    await act(async () => {
      await repos.orders.updateStatus(order.id, 'preparing');
      await repos.orders.updateStatus(order.id, 'picked_up');
    });

    const n = nav();
    const result = render(order.id, n);
    await flush();

    await act(async () => {
      press(result.root, 'btn-job-next');
    });
    await flush();

    expect((await repos.orders.get(order.id))?.status).toBe('delivered');
    expect(n.goBack).toHaveBeenCalled();
  });

  /** งานที่ไม่ใช่ของเรา หรือจบไปแล้ว ต้องบอกตรง ๆ ไม่ใช่จอเปล่า */
  it('ไม่พบงานนี้ บอกว่าไม่พบ ไม่ใช่จอว่าง', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    const result = render('ไม่มีอยู่จริง', nav());
    await flush();

    expect(findAll(result.root, 'job-missing').length).toBe(1);
  });
});
