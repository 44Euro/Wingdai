import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { MerchantOrdersScreen } from '../../src/features/merchant/screens/MerchantOrdersScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';
import i18n from 'i18next';

beforeAll(async () => {
  await initI18n();
  // เครื่องที่รันเทสต์เป็น locale อังกฤษ แต่ข้อความที่ยืนยันด้านล่างเป็นไทย
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

/** นับเฉพาะ host node react-test-renderer คืนทั้ง composite และ host ที่มี testID เดียวกัน */
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

/** ลูกค้าสั่งอาหารจากครัวมาลีหนึ่งใบ แล้วสลับไปเป็นเจ้าของร้าน */
async function placeOrderThenBecomeOwner() {
  let orderId = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 2, choiceIds: ['c-spicy-mid', 'c-egg'] }],
      paymentMethod: 'cash',
    });
    orderId = order.id;
    await useAuthStore.getState().login('malee', '1234');
  });
  return orderId;
}

function render(nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      // mutation มี timer เก็บ cache ของตัวเองแยกจาก query ไม่ปิดแล้ว jest ไม่ยอมจบ
      mutations: { retry: false, gcTime: 0 },
    },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <MerchantOrdersScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'MerchantOrders' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('MerchantOrdersScreen — คิวออร์เดอร์ของร้าน', () => {
  it('ออร์เดอร์ใหม่โผล่ในคิวพร้อมนาฬิกานับถอยหลัง', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const result = render({ navigate: jest.fn() });
    await flush();

    expect(findAll(result.root, 'screen-merchant-orders').length).toBe(1);
    expect(findAny(result.root, `queue-card-${orderId}`).length).toBeGreaterThanOrEqual(1);
    // ⭐ นาฬิกาต้องมี เป็นหัวใจของจอนี้ตาม design M3
    expect(findAll(result.root, `queue-countdown-${orderId}`).length).toBe(1);
  });

  /** ยอดที่โชว์ต้องเป็น "ร้านได้เท่าไหร่" = ค่าอาหาร − 15% (product-spec §6.1) */
  it('โชว์ยอดที่ร้านได้จริง ไม่ใช่ยอดที่ลูกค้าจ่าย', async () => {
    await placeOrderThenBecomeOwner();
    const result = render({ navigate: jest.fn() });
    await flush();

    const texts = result.root
      .findAll((n) => typeof n.type === 'string' && n.props?.children !== undefined)
      .map((n) => String(n.props.children));

    expect(texts).toContain('฿110.50');
    // ยอดรวมที่ลูกค้าจ่ายคือ ฿150 (ค่าอาหาร ฿130 + ค่าส่ง ฿15 + ค่าบริการ ฿5)
    expect(texts).not.toContain('฿150');
    expect(texts).not.toContain('฿130');
  });

  it('กดการ์ดแล้วไปจอรายละเอียดพร้อม orderId', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();

    act(() => {
      findAny(result.root, `queue-card-${orderId}`)[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('MerchantOrderDetail', { orderId });
  });

  it('สลับไปแท็บ "จบแล้ว" แล้วออร์เดอร์ที่ยังไม่จบต้องหายไป', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const result = render({ navigate: jest.fn() });
    await flush();

    act(() => {
      findAny(result.root, 'merchant-scope-history')[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `queue-card-${orderId}`).length).toBe(0);
    expect(findAll(result.root, 'queue-empty').length).toBe(1);
  });

  it('ร้านกดปิดรับออร์เดอร์ได้ และใบที่ค้างอยู่ยังอยู่ในคิว', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const result = render({ navigate: jest.fn() });
    await flush();

    act(() => {
      findAny(result.root, 'toggle-shop-open')[0].props.onValueChange(false);
    });
    await flush();

    expect(await repos.merchant.myRestaurants().then((s) => s[0]!.isOpen)).toBe(false);
    // ปิดร้าน = หยุดรับใบใหม่ ไม่ใช่ทิ้งใบที่รับปากลูกค้าไปแล้ว
    expect(findAny(result.root, `queue-card-${orderId}`).length).toBeGreaterThanOrEqual(1);
  });
});
