import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { NotificationsScreen } from '../../src/features/customer/screens/NotificationsScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { useNotificationStore } from '../../src/features/customer/notificationStore';
import { buildNotifications, countUnread } from '../../src/features/customer/notifications';
import { repos } from '../../src/data';
import type { Order, Restaurant } from '../../src/data/types';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
  useNotificationStore.setState({ lastReadAt: null });
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
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

function render(nav: { navigate: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <NotificationsScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'Notifications' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const restaurants = [{ id: 'r-1', name: 'ครัวมาลี' } as Restaurant];
const order = (id: string, at: string, status: Order['status'] = 'preparing') =>
  ({ id, restaurantId: 'r-1', status, createdAt: at } as Order);

describe('buildNotifications', () => {
  const now = new Date('2026-07-29T12:00:00.000Z').getTime();

  it('ออร์เดอร์วันนี้เข้ากลุ่ม today ออร์เดอร์เก่าเข้ากลุ่ม earlier', () => {
    const list = buildNotifications(
      [order('o-1', '2026-07-29T11:00:00.000Z'), order('o-2', '2026-07-25T11:00:00.000Z')],
      restaurants,
      null,
      now,
    );
    expect(list.find((n) => n.orderId === 'o-1')?.group).toBe('today');
    expect(list.find((n) => n.orderId === 'o-2')?.group).toBe('earlier');
  });

  it('เรียงใหม่สุดขึ้นก่อน', () => {
    const list = buildNotifications(
      [order('o-old', '2026-07-25T11:00:00.000Z'), order('o-new', '2026-07-29T11:00:00.000Z')],
      restaurants,
      null,
      now,
    );
    expect(list[0].orderId).toBe('o-new');
  });

  it('ยังไม่เคยกดอ่าน → ยังไม่อ่านทุกข้อความ', () => {
    const list = buildNotifications([order('o-1', '2026-07-29T11:00:00.000Z')], restaurants, null, now);
    expect(countUnread(list)).toBe(1);
  });

  it('อ่านหลังเวลาที่ออร์เดอร์เกิด → นับเป็นอ่านแล้ว', () => {
    const list = buildNotifications(
      [order('o-1', '2026-07-29T11:00:00.000Z')],
      restaurants,
      '2026-07-29T11:30:00.000Z',
      now,
    );
    expect(countUnread(list)).toBe(0);
  });

  it('ออร์เดอร์ที่เกิดหลังเวลาอ่านล่าสุด → กลับมาเป็นยังไม่อ่าน', () => {
    const list = buildNotifications(
      [order('o-1', '2026-07-29T11:45:00.000Z')],
      restaurants,
      '2026-07-29T11:30:00.000Z',
      now,
    );
    expect(countUnread(list)).toBe(1);
  });
});

describe('NotificationsScreen (C20)', () => {
  it('ยังไม่มีออร์เดอร์ → ขึ้น empty state ไม่มีลิงก์อ่านทั้งหมด', async () => {
    useAuthStore.setState({ account: null });
    const result = render({ navigate: jest.fn() });
    await flush();
    expect(findAll(result.root, 'notifications-empty').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'link-mark-all-read').length).toBe(0);
  });

  it('มีออร์เดอร์ → ขึ้นการ์ดแจ้งเตือนที่กดแล้วไปจอติดตาม', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account });
    const created = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-4', quantity: 1, choiceIds: [] }],
      paymentMethod: 'promptpay',
    });

    const navigate = jest.fn();
    const result = render({ navigate });
    await flush();

    const card = findAll(result.root, `notification-${created.id}-created`);
    expect(card.length).toBeGreaterThanOrEqual(1);
    act(() => {
      card[0].props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('OrderTracking', { orderId: created.id });
  });

  it('กดอ่านทั้งหมด → จุดยังไม่อ่านหายไป', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account });
    const result = render({ navigate: jest.fn() });
    await flush();

    expect(findAll(result.root, 'link-mark-all-read').length).toBeGreaterThanOrEqual(1);
    act(() => {
      findAll(result.root, 'link-mark-all-read')[0].props.onPress();
    });
    await flush();
    expect(useNotificationStore.getState().lastReadAt).not.toBeNull();
  });
});
