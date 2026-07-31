import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { ReportProblemScreen } from '../../src/features/customer/screens/ReportProblemScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

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
function findAny(root: ReactTestRenderer.ReactTestInstance, id: string) {
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

async function deliveredOrder() {
  let orderId = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    orderId = order.id;
    for (const s of ['accepted', 'preparing', 'picked_up', 'delivered'] as const) {
      // eslint-disable-next-line no-await-in-loop
      await repos.orders.updateStatus(orderId, s);
    }
  });
  return orderId;
}

function render(orderId: string, nav: { goBack: jest.Mock }) {
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
            <ReportProblemScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'ReportProblem', params: { orderId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('ReportProblemScreen — ลูกค้าแจ้งปัญหา (§6.4)', () => {
  it('ยังไม่เลือกเหตุผลหรือยังไม่พิมพ์อะไร ส่งไม่ได้', async () => {
    const orderId = await deliveredOrder();
    const result = render(orderId, { goBack: jest.fn() });
    await flush();

    expect(findAll(result.root, 'screen-report-problem').length).toBe(1);
    expect(findAny(result.root, 'btn-report-submit')[0].props.disabled).toBe(true);

    act(() => {
      findAny(result.root, 'reason-wrong_item')[0].props.onPress();
    });
    // เลือกเหตุผลแล้วแต่ยังไม่เล่าอะไร ยังส่งไม่ได้ เรื่องที่ไม่มีรายละเอียดตัดสินไม่ได้
    expect(findAny(result.root, 'btn-report-submit')[0].props.disabled).toBe(true);
  });

  it('เลือกเหตุผล + เล่าเรื่อง แล้วส่งได้ และเรื่องเข้าคิวแอดมินจริง', async () => {
    const orderId = await deliveredOrder();
    const result = render(orderId, { goBack: jest.fn() });
    await flush();

    act(() => {
      findAny(result.root, 'reason-wrong_item')[0].props.onPress();
      findAny(result.root, 'input-report-detail')[0].props.onChangeText('ได้ข้าวผัดแทน');
    });
    await act(async () => {
      findAny(result.root, 'btn-report-submit')[0].props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'report-sent').length).toBe(1);
    const mine = await repos.refunds.mine();
    expect(mine.some((c) => c.orderId === orderId)).toBe(true);
  });

  /** §6.4 คนตัดสินคือแอดมิน จอนี้ต้องไม่ทำให้ลูกค้าเข้าใจว่าเงินกำลังจะเข้า */
  it('ไม่สัญญาว่าจะได้เงินคืน และไม่โชว์ยอดที่ระบบเสนอ', async () => {
    const orderId = await deliveredOrder();
    const result = render(orderId, { goBack: jest.fn() });
    await flush();

    act(() => {
      findAny(result.root, 'reason-wrong_item')[0].props.onPress();
      findAny(result.root, 'input-report-detail')[0].props.onChangeText('ของผิด');
    });
    await act(async () => {
      findAny(result.root, 'btn-report-submit')[0].props.onPress();
    });
    await flush();

    const texts = result.root
      .findAll((n) => typeof n.type === 'string' && n.props?.children !== undefined)
      .map((n) => String(n.props.children));

    expect(texts.some((s) => s.includes('ไม่ได้อนุมัติอัตโนมัติ'))).toBe(true);
    expect(texts.some((s) => s.includes('฿'))).toBe(false);
  });

  it('แจ้งซ้ำใบเดิมโดนปฏิเสธพร้อมบอกเหตุผล', async () => {
    const orderId = await deliveredOrder();
    await act(async () => {
      await repos.refunds.open({ orderId, reason: 'late', detail: 'ช้ามาก' });
    });

    const result = render(orderId, { goBack: jest.fn() });
    await flush();
    act(() => {
      findAny(result.root, 'reason-wrong_item')[0].props.onPress();
      findAny(result.root, 'input-report-detail')[0].props.onChangeText('แจ้งซ้ำ');
    });
    await act(async () => {
      findAny(result.root, 'btn-report-submit')[0].props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'report-error').length).toBe(1);
  });
});
