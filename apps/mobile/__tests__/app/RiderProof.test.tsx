import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderProofScreen } from '../../src/features/rider/screens/RiderProofScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';
import { pickImage } from '../../src/lib/media/pickImage';

/** เปิดคลังรูปจริงในเทสต์ไม่ได้ mock แค่ตัวเลือกรูป ที่เหลือเป็นของจริงทั้งหมด */
jest.mock('../../src/lib/media/pickImage', () => ({ pickImage: jest.fn() }));
const pickImageMock = pickImage as jest.MockedFunction<typeof pickImage>;

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

beforeEach(() => {
  pickImageMock.mockReset();
  pickImageMock.mockResolvedValue({ uri: 'file:///tmp/proof.jpg', ext: 'jpg' });
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
/** ปุ่มปิดงานเป็น SlideToConfirm testID หลักอยู่ที่รางซึ่งไม่มี onPress */
function slider(root: ReactTestRenderer.ReactTestInstance) {
  const node = root
    .findAll((n) => n.props?.testID === 'btn-complete-delivery-press')
    .find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error('ไม่พบปุ่มปิดงาน');
  return node;
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

/** เดินจนถึงสถานะพร้อมส่ง แล้วคืนออร์เดอร์ (ซึ่งมี deliveryPin ของลูกค้าติดมา) */
async function jobReadyToDeliver() {
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

function render(orderId: string, nav: { goBack: jest.Mock; popToTop: jest.Mock }) {
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
            <RiderProofScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'RiderProof', params: { orderId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const nav = () => ({ goBack: jest.fn(), popToTop: jest.fn() });

/** แตะปุ่มถ่ายรูป pickImage ถูก mock ไว้ให้คืนไฟล์เสมอ */
async function attachPhoto(root: ReactTestRenderer.ReactTestInstance) {
  const btn = root
    .findAll((n) => n.props?.testID === 'btn-proof-photo')
    .find((n) => typeof n.props?.onPress === 'function')!;
  await act(async () => {
    btn.props.onPress();
  });
  await flush();
}

/** พิมพ์รหัสทีละหลักลงช่องทั้งสี่ */
async function typePin(root: ReactTestRenderer.ReactTestInstance, pin: string) {
  for (let i = 0; i < 4; i += 1) {
    const box = findAll(root, `pin-${i}`)[0]!;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      box.props.onChangeText(pin[i]);
    });
  }
}

describe('RiderProofScreen — ยืนยันส่ง (R11)', () => {
  it('ยังไม่กรอกรหัส ปุ่มปิดงานกดไม่ได้', async () => {
    const order = await jobReadyToDeliver();
    const result = render(order.id, nav());
    await flush();

    expect(findAll(result.root, 'screen-rider-proof').length).toBe(1);
    const btn = slider(result.root);
    expect(btn.props.disabled).toBe(true);
  });

  /** product-spec §6.4 รหัสนี้เป็นหลักฐานว่าไปถึงตัวลูกค้าจริง */
  it('รหัสผิดปิดงานไม่ได้ สถานะไม่ขยับ และขึ้นข้อความบอก', async () => {
    const order = await jobReadyToDeliver();
    const n = nav();
    const result = render(order.id, n);
    await flush();

    const wrong = order.deliveryPin === '0000' ? '1111' : '0000';
    await attachPhoto(result.root);
    await typePin(result.root, wrong);
    await act(async () => {
      slider(result.root).props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'proof-error').length).toBe(1);
    expect(n.popToTop).not.toHaveBeenCalled();

    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
    expect((await repos.orders.get(order.id))?.status).toBe('picked_up');
  });

  it('รหัสถูกปิดงานได้ แล้วกลับไปหน้าแรกของไรเดอร์', async () => {
    const order = await jobReadyToDeliver();
    const n = nav();
    const result = render(order.id, n);
    await flush();

    await attachPhoto(result.root);
    await typePin(result.root, order.deliveryPin!);
    await act(async () => {
      slider(result.root).props.onPress();
    });
    await flush();

    expect(n.popToTop).toHaveBeenCalled();
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
    expect((await repos.orders.get(order.id))?.status).toBe('delivered');
  });

  /** วางรหัสทั้งชุดทีเดียวต้องได้ ไม่ใช่บังคับพิมพ์ทีละช่อง */
  it('วางรหัสสี่หลักทีเดียวลงช่องแรกได้', async () => {
    const order = await jobReadyToDeliver();
    const result = render(order.id, nav());
    await flush();

    await attachPhoto(result.root);
    await act(async () => {
      findAll(result.root, 'pin-0')[0]!.props.onChangeText(order.deliveryPin!);
    });
    await flush();

    expect(slider(result.root).props.disabled).toBe(false);
  });

  /** §6.4 รูปคือหลักฐานว่าของถึงที่จริง ส่วนรหัสคือหลักฐานว่าเจอคน */
  it('มีรหัสครบแต่ยังไม่มีรูป ปิดงานไม่ได้', async () => {
    const order = await jobReadyToDeliver();
    const result = render(order.id, nav());
    await flush();

    await typePin(result.root, order.deliveryPin!);
    expect(slider(result.root).props.disabled).toBe(true);
  });

  it('มีรูปแต่ยังไม่ครบรหัส ปิดงานไม่ได้', async () => {
    const order = await jobReadyToDeliver();
    const result = render(order.id, nav());
    await flush();

    await attachPhoto(result.root);
    expect(findAll(result.root, 'proof-photo-preview').length).toBe(1);
    expect(slider(result.root).props.disabled).toBe(true);
  });

  /** ยกเลิกตอนเลือกรูปไม่ใช่ข้อผิดพลาด ไม่ต้องขึ้นอะไร แค่ยังไม่มีรูป */
  it('ยกเลิกตอนเลือกรูป ไม่ขึ้น error', async () => {
    pickImageMock.mockResolvedValue(null);
    const order = await jobReadyToDeliver();
    const result = render(order.id, nav());
    await flush();

    await attachPhoto(result.root);

    expect(findAll(result.root, 'proof-error').length).toBe(0);
    expect(findAll(result.root, 'proof-photo-preview').length).toBe(0);
  });
});
