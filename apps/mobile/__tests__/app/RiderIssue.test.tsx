import React from 'react';
import { Linking } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderIssueScreen } from '../../src/features/rider/screens/RiderIssueScreen';
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
let client: QueryClient | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  client?.clear();
  client = null;
  r = null;
  jest.restoreAllMocks();
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function');
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

/** ลูกค้าสั่ง → ไรเดอร์รับของแล้วกำลังไปส่ง */
async function jobInTransit() {
  let order!: Awaited<ReturnType<typeof repos.orders.create>>;
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    await repos.orders.updateStatus(order.id, 'accepted');
    await useAuthStore.getState().login('rider_ann', '1234');
    await repos.rider.acceptOffer(order.id);
    await repos.orders.updateStatus(order.id, 'preparing');
    await repos.orders.updateStatus(order.id, 'picked_up');
  });
  return order;
}

function render(orderId: string) {
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
            <RiderIssueScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ key: 'k', name: 'RiderIssue', params: { orderId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('RiderIssueScreen — แจ้งปัญหาระหว่างส่ง (R9)', () => {
  it('ยังไม่เลือกหัวข้อ ส่งไม่ได้', async () => {
    const order = await jobInTransit();
    const result = render(order.id);
    await flush();

    expect(findAll(result.root, 'screen-rider-issue').length).toBe(1);
    expect(pressable(result.root, 'btn-send-issue')[0]!.props.disabled).toBe(true);
  });

  it('มีหัวข้อครบสามอย่าง', async () => {
    const order = await jobInTransit();
    const result = render(order.id);
    await flush();

    for (const k of ['cannot_reach_customer', 'bad_address', 'accident']) {
      expect(findAll(result.root, `issue-${k}`).length).toBe(1);
    }
  });

  /** กติกาหลักของจอนี้ แจ้งแล้วเรื่องเข้าคิวแอดมิน แต่ ออร์เดอร์ไม่ขยับ */
  it('เลือกหัวข้อแล้วส่งได้ เรื่องเข้าคิวแอดมิน สถานะออร์เดอร์ไม่ขยับ', async () => {
    const order = await jobInTransit();
    const result = render(order.id);
    await flush();

    await act(async () => {
      pressable(result.root, 'issue-cannot_reach_customer')[0]!.props.onPress();
    });
    await flush();

    await act(async () => {
      pressable(result.root, 'btn-send-issue')[0]!.props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'issue-sent').length).toBe(1);

    await act(async () => {
      await useAuthStore.getState().login('admin_root', '1234');
    });
    const exceptions = await repos.admin.exceptions();
    expect(exceptions.some((e) => e.orderId === order.id && e.kind === 'rider_issue')).toBe(true);

    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
    expect((await repos.orders.get(order.id))?.status).toBe('picked_up');
  });

  /** ส่งแล้วต้องไม่มีปุ่มให้กดซ้ำ ไม่งั้นเรื่องเดียวเข้าคิวแอดมินหลายรอบ */
  it('ส่งแล้วปุ่มส่งหายไป เหลือข้อความยืนยัน', async () => {
    const order = await jobInTransit();
    const result = render(order.id);
    await flush();

    await act(async () => {
      pressable(result.root, 'issue-accident')[0]!.props.onPress();
    });
    await act(async () => {
      pressable(result.root, 'btn-send-issue')[0]!.props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'btn-send-issue').length).toBe(0);
    expect(findAll(result.root, 'issue-sent').length).toBe(1);
  });

  /** ตอนเกิดอุบัติเหตุ การโทรเร็วกว่าการพิมพ์ฟอร์ม ปุ่มนี้จึงต้องมีและต้องโทรได้จริง */
  it('ปุ่มสายด่วนโทรออกด้วยเบอร์จาก i18n', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const order = await jobInTransit();
    const result = render(order.id);
    await flush();

    await act(async () => {
      pressable(result.root, 'btn-call-hotline')[0]!.props.onPress();
    });

    const expected = `tel:${i18n.t('rider.issue.hotlineNumber').replace(/[^0-9+]/g, '')}`;
    expect(spy).toHaveBeenCalledWith(expected);
  });
});
