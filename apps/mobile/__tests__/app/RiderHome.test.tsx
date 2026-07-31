import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderHomeScreen } from '../../src/features/rider/screens/RiderHomeScreen';
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
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

/** ลูกค้าสั่ง → ร้านรับ → มีออร์เดอร์ที่รอไรเดอร์อยู่หนึ่งใบ แล้วสลับเป็นไรเดอร์ */
async function orderWaitingForRider() {
  let orderId = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'cash',
    });
    orderId = order.id;
    await repos.orders.updateStatus(orderId, 'accepted');
    await useAuthStore.getState().login('rider_ann', '1234');
  });
  return orderId;
}

function render(nav: { navigate: jest.Mock }) {
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
            <RiderHomeScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'RiderHome' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

/**
 * เปิดรับงานแล้วคืน orderId ของงานที่ถูกเสนอ "จริง"
 *
 * ไม่สมมติว่าเป็นใบที่เทสต์นี้เพิ่งสร้าง เพราะกติกาคือเสนอใบที่รอนานที่สุดก่อน
 * (ตรงกับ tick() ฝั่งเซิร์ฟเวอร์ที่เรียงตาม createdAt) — ใบจากเทสต์ก่อนหน้าที่ยังค้าง
 * จึงถูกเสนอก่อน ซึ่งเป็นพฤติกรรมที่ถูก ไม่ใช่บั๊ก
 */
async function goOnline(result: ReactTestRenderer.ReactTestRenderer) {
  await act(async () => {
    findAny(result.root, 'toggle-rider-online')[0].props.onValueChange(true);
  });
  await flush();
  return (await repos.rider.status()).offer?.orderId ?? '';
}

describe('RiderHomeScreen', () => {
  it('ยังไม่เปิดรับงาน = ไม่มีข้อเสนอเข้ามา', async () => {
    await orderWaitingForRider();
    const result = render({ navigate: jest.fn() });
    await flush();

    expect(findAll(result.root, 'screen-rider-home').length).toBe(1);
    expect(findAny(result.root, 'rider-offer').length).toBe(0);
    expect(findAll(result.root, 'rider-no-jobs').length).toBe(1);
  });

  it('เปิดรับงานแล้วได้ข้อเสนอพร้อมนาฬิกานับถอยหลัง', async () => {
    await orderWaitingForRider();
    const result = render({ navigate: jest.fn() });
    await flush();
    await goOnline(result);

    expect(findAny(result.root, 'rider-offer').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'offer-countdown').length).toBe(1);
  });

  /**
   * ไรเดอร์ต้องรู้ว่าต้องเก็บเงินเท่าไหร่ **ก่อน** กดรับ
   * ข้าวกะเพรา ฿50 + ค่าส่ง ฿15 + ค่าบริการ ฿5 = ฿70
   */
  it('บอกยอดเงินสดที่ต้องเก็บก่อนกดรับงาน', async () => {
    await orderWaitingForRider();
    const result = render({ navigate: jest.fn() });
    await flush();
    await goOnline(result);

    expect(findAll(result.root, 'offer-collect-cash').length).toBe(1);
    const texts = result.root
      .findAll((n) => typeof n.type === 'string' && n.props?.children !== undefined)
      .map((n) => String(n.props.children));
    expect(texts.some((s) => s.includes('฿70'))).toBe(true);
  });

  it('กดรับงานแล้วงานย้ายไปอยู่ในรายการงานที่กำลังทำ', async () => {
    await orderWaitingForRider();
    const result = render({ navigate: jest.fn() });
    await flush();
    const orderId = await goOnline(result);

    await act(async () => {
      findAny(result.root, 'btn-accept-offer')[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `rider-job-${orderId}`).length).toBeGreaterThanOrEqual(1);
    expect((await repos.orders.get(orderId))?.riderId).toBeTruthy();
  });

  /**
   * §3 ข้อ 4 — ปฏิเสธงานได้โดยไม่มีบทลงโทษ และใบเดิมต้องไม่ถูกยัดกลับมา
   * แต่ระบบ **ต้องเลื่อนไปเสนอใบถัดไป** ไม่ใช่หยุดเสนอทั้งหมด (§6.3)
   */
  it('กดผ่านงานแล้วไม่ถูกเสนอใบเดิมซ้ำ', async () => {
    await orderWaitingForRider();
    const result = render({ navigate: jest.fn() });
    await flush();
    const declined = await goOnline(result);

    await act(async () => {
      findAny(result.root, 'btn-decline-offer')[0].props.onPress();
    });
    await flush();

    const next = (await repos.rider.status()).offer?.orderId ?? null;
    expect(next).not.toBe(declined);
  });

  it('กดการ์ดงานแล้วไปจอรายละเอียดงาน', async () => {
    await orderWaitingForRider();
    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();
    const orderId = await goOnline(result);

    await act(async () => {
      findAny(result.root, 'btn-accept-offer')[0].props.onPress();
    });
    await flush();

    act(() => {
      findAny(result.root, `rider-job-${orderId}`)[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RiderJob', { orderId });
  });
});
