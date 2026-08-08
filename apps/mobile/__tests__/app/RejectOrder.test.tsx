import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { RejectOrderScreen } from '../../src/features/merchant/screens/RejectOrderScreen';
import { EditMenuItemScreen } from '../../src/features/merchant/screens/EditMenuItemScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => { await initI18n(); });

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => { act(() => { r?.unmount(); }); r = null; });

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((res) => setTimeout(res, 5)); });
  }
}

async function placeOrderThenBecomeOwner() {
  let orderId = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid', 'c-egg'] }],
      paymentMethod: 'cash',
    });
    orderId = order.id;
    await useAuthStore.getState().login('malee', '1234');
  });
  return orderId;
}

function renderScreen(node: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>{node}</NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('RejectOrderScreen (M12)', () => {
  it('ยังไม่เลือกเหตุผล กดยืนยันไม่ได้', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const result = renderScreen(
      <RejectOrderScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{ key: 'k', name: 'RejectOrder', params: { orderId } } as never}
      />,
    );
    await flush();
    expect(findAll(result.root, 'btn-confirm-reject')[0]!.props.disabled).toBe(true);
  });

  it('เลือกเหตุผลแล้วปฏิเสธได้ และเหตุผลติดไปกับออร์เดอร์', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    const goBack = jest.fn();
    const result = renderScreen(
      <RejectOrderScreen
        navigation={{ goBack } as never}
        route={{ key: 'k', name: 'RejectOrder', params: { orderId } } as never}
      />,
    );
    await flush();

    act(() => { findAll(result.root, 'reason-out_of_stock')[0]!.props.onPress(); });
    await act(async () => { findAll(result.root, 'btn-confirm-reject')[0]!.props.onPress(); });
    await flush();

    const order = await repos.orders.get(orderId);
    expect(order?.status).toBe('cancelled');
    expect(order?.cancelReason).toBe('out_of_stock');
    // ลูกค้าต้องแยกออกว่าร้านปฏิเสธ ไม่ใช่ตัวเองกดยกเลิก
    expect(order?.cancelledBy).toBe('restaurant');
    expect(goBack).toHaveBeenCalled();
  });

  it('ร้านยกเลิกโดยไม่บอกเหตุผล รีโปปฏิเสธ ไม่ใช่แค่จอกัน', async () => {
    const orderId = await placeOrderThenBecomeOwner();
    await expect(repos.orders.updateStatus(orderId, 'cancelled')).rejects.toThrow();
    expect((await repos.orders.get(orderId))?.status).toBe('created');
  });

  it('ลูกค้ายกเลิกเองไม่ต้องมีเหตุผล และบันทึกว่าลูกค้าเป็นคนกด', async () => {
    let orderId = '';
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
      const order = await repos.orders.create({
        restaurantId: 'r-malee',
        items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid', 'c-egg'] }],
        paymentMethod: 'cash',
      });
      orderId = order.id;
      await repos.orders.updateStatus(order.id, 'cancelled');
    });
    const order = await repos.orders.get(orderId);
    expect(order?.status).toBe('cancelled');
    expect(order?.cancelledBy).toBe('customer');
    expect(order?.cancelReason).toBeNull();
  });
});

describe('EditMenuItemScreen (M13)', () => {
  async function loginMalee() {
    await act(async () => { await useAuthStore.getState().login('malee', '1234'); });
  }

  it('เปิดมาเห็นค่าเดิมของจานนั้น', async () => {
    await loginMalee();
    const result = renderScreen(
      <EditMenuItemScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{
          key: 'k', name: 'EditMenuItem',
          params: { restaurantId: 'r-malee', menuItemId: 'm-malee-1' },
        } as never}
      />,
    );
    await flush();
    const menu = await repos.catalog.getMenu('r-malee');
    const item = menu.find((m) => m.id === 'm-malee-1')!;
    expect(findAll(result.root, 'input-item-name')[0]!.props.value).toBe(item.name);
    expect(findAll(result.root, 'input-item-price')[0]!.props.value).toBe(String(item.price / 100));
  });

  it('แก้ชื่อกับราคาแล้วบันทึกได้', async () => {
    await loginMalee();
    const goBack = jest.fn();
    const result = renderScreen(
      <EditMenuItemScreen
        navigation={{ goBack } as never}
        route={{
          key: 'k', name: 'EditMenuItem',
          params: { restaurantId: 'r-malee', menuItemId: 'm-malee-1' },
        } as never}
      />,
    );
    await flush();

    act(() => { findAll(result.root, 'input-item-name')[0]!.props.onChangeText('ข้าวกะเพราหมูกรอบ'); });
    act(() => { findAll(result.root, 'input-item-price')[0]!.props.onChangeText('72'); });
    await act(async () => { findAll(result.root, 'btn-save-item')[0]!.props.onPress(); });
    await flush();

    const menu = await repos.catalog.getMenu('r-malee');
    const item = menu.find((m) => m.id === 'm-malee-1')!;
    expect(item.name).toBe('ข้าวกะเพราหมูกรอบ');
    // เก็บเป็นสตางค์จำนวนเต็มเสมอ (§5 กฎข้อ 1) ไม่ใช่ 72 บาทลอยตัว
    expect(item.price).toBe(7200);
    expect(goBack).toHaveBeenCalled();
  });

  it('ราคา 0 หรือชื่อว่าง บันทึกไม่ได้', async () => {
    await loginMalee();
    const result = renderScreen(
      <EditMenuItemScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{
          key: 'k', name: 'EditMenuItem',
          params: { restaurantId: 'r-malee', menuItemId: 'm-malee-2' },
        } as never}
      />,
    );
    await flush();

    act(() => { findAll(result.root, 'input-item-price')[0]!.props.onChangeText('0'); });
    expect(findAll(result.root, 'btn-save-item')[0]!.props.disabled).toBe(true);

    act(() => { findAll(result.root, 'input-item-price')[0]!.props.onChangeText('50'); });
    act(() => { findAll(result.root, 'input-item-name')[0]!.props.onChangeText('  '); });
    expect(findAll(result.root, 'btn-save-item')[0]!.props.disabled).toBe(true);
  });
});
