import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderPickupScreen } from '../../src/features/rider/screens/RiderPickupScreen';
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
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function');
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

/** ลูกค้าสั่งสองจาน จานแรกฝากข้อความไว้ ครัวเริ่มทำแล้ว ไรเดอร์รับงานแล้ว */
async function jobAtRestaurant(startCooking = true) {
  let order!: Awaited<ReturnType<typeof repos.orders.create>>;
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [
        {
          menuItemId: 'm-malee-1',
          quantity: 2,
          choiceIds: ['c-spicy-mid'],
          note: 'ไม่ใส่ผักชี',
        },
        { menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] },
      ],
      paymentMethod: 'promptpay',
    });
    await repos.orders.updateStatus(order.id, 'accepted');
    await useAuthStore.getState().login('rider_ann', '1234');
    await repos.rider.setOnline(true, { lat: 13.7815, lng: 100.545 });
    await repos.rider.acceptOffer(order.id);
    if (startCooking) await repos.orders.updateStatus(order.id, 'preparing');
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
            <RiderPickupScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'RiderPickup', params: { orderId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const nav = () => ({ goBack: jest.fn() });

/** ติ๊กครบทุกรายการในถุง */
async function tickAll(root: ReactTestRenderer.ReactTestInstance, count: number) {
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      pressable(root, `pickup-item-${i}`)[0]!.props.onPress();
    });
  }
}

describe('RiderPickupScreen — จุดรับอาหาร (R10)', () => {
  /** ข้อความที่ลูกค้าฝากถึงร้านต้องเห็นชัดบนจอนี้ เป็นที่สุดท้ายที่มันยังแก้อะไรได้ */
  it('โชว์ของในถุงพร้อมตัวเลือกและข้อความที่ลูกค้าฝากไว้', async () => {
    const order = await jobAtRestaurant();
    const result = render(order.id, nav());
    await flush();

    expect(findAll(result.root, 'screen-rider-pickup').length).toBe(1);
    expect(findAll(result.root, 'pickup-item-0').length).toBe(1);
    expect(findAll(result.root, 'pickup-item-1').length).toBe(1);
    expect(textOf(result.root, 'pickup-choices-0')).toContain('เผ็ดกลาง');
    expect(textOf(result.root, 'pickup-note-0')).toContain('ไม่ใส่ผักชี');
    // จานที่ไม่ได้ฝากอะไรต้องไม่มีกล่องข้อความว่างเปล่าโผล่มา
    expect(findAll(result.root, 'pickup-note-1').length).toBe(0);
  });

  it('ยังติ๊กไม่ครบ กดยืนยันรับของไม่ได้', async () => {
    const order = await jobAtRestaurant();
    const result = render(order.id, nav());
    await flush();

    expect(pressable(result.root, 'btn-confirm-pickup')[0]!.props.disabled).toBe(true);
    expect(findAll(result.root, 'pickup-check-all').length).toBe(1);

    await act(async () => {
      pressable(result.root, 'pickup-item-0')[0]!.props.onPress();
    });
    await flush();
    expect(pressable(result.root, 'btn-confirm-pickup')[0]!.props.disabled).toBe(true);
  });

  it('ติ๊กครบแล้วยืนยันได้ สถานะเปลี่ยนเป็นรับของแล้ว', async () => {
    const order = await jobAtRestaurant();
    const n = nav();
    const result = render(order.id, n);
    await flush();

    await tickAll(result.root, 2);
    expect(pressable(result.root, 'btn-confirm-pickup')[0]!.props.disabled).toBe(false);

    await act(async () => {
      pressable(result.root, 'btn-confirm-pickup')[0]!.props.onPress();
    });
    await flush();

    expect(n.goBack).toHaveBeenCalled();
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
    expect((await repos.orders.get(order.id))?.status).toBe('picked_up');
  });

  /** ครัวยังไม่เริ่มทำ = รับของไม่ได้ ต่อให้ติ๊กครบแล้ว (orders/stateMachine.ts) */
  it('ครัวยังไม่เริ่มทำ ปุ่มกดไม่ได้แม้ติ๊กครบ', async () => {
    const order = await jobAtRestaurant(false);
    const result = render(order.id, nav());
    await flush();

    await tickAll(result.root, 2);
    expect(pressable(result.root, 'btn-confirm-pickup')[0]!.props.disabled).toBe(true);
    expect(findAll(result.root, 'pickup-waiting-kitchen').length).toBe(1);
  });

  /** §6.3 บอกว่าอีกกี่นาทีอาหารเสร็จ ไรเดอร์จะได้ไม่ไปยืนรอฟรี */
  it('บอกว่าอีกกี่นาทีอาหารเสร็จ', async () => {
    const order = await jobAtRestaurant();
    const result = render(order.id, nav());
    await flush();

    // ครัวมาลีตั้งเวลาทำไว้ 12 นาที และเพิ่งรับออร์เดอร์ไปเมื่อกี้
    expect(textOf(result.root, 'pickup-ready-in')).toContain('12');
  });

  it('ระยะถึงร้านคิดจากตำแหน่งจริงของไรเดอร์', async () => {
    const order = await jobAtRestaurant();
    const result = render(order.id, nav());
    await flush();

    // ตำแหน่งไรเดอร์ตั้งไว้ที่บ้านลูกค้า ซึ่งห่างครัวมาลี 0.6 กม. ตาม seed
    expect(textOf(result.root, 'pickup-distance')).toContain('0.6');
  });

  it('ไม่พบงานนี้ บอกว่าไม่พบ ไม่ใช่จอว่าง', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    const result = render('ไม่มีอยู่จริง', nav());
    await flush();

    expect(findAll(result.root, 'pickup-missing').length).toBe(1);
  });
});
