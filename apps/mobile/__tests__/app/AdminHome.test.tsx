import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { AdminHomeScreen } from '../../src/features/admin/screens/AdminHomeScreen';
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

/**
 * ลูกค้าสั่ง → ส่งถึง → แจ้งปัญหา แล้วสลับเป็นแอดมิน
 * `reason` เลือกได้ เพื่อทดสอบทั้งเคสที่ระบบเสนอยอดและเคสที่ไม่เสนอ
 */
async function disputeAsCustomer(reason: 'wrong_item' | 'other' = 'wrong_item') {
  let caseId = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    for (const s of ['accepted', 'preparing', 'picked_up', 'delivered'] as const) {
      // eslint-disable-next-line no-await-in-loop
      await repos.orders.updateStatus(order.id, s);
    }
    const c = await repos.refunds.open({
      orderId: order.id, reason, detail: 'ทดสอบ', hasPhoto: true,
    });
    caseId = c.id;
    await useAuthStore.getState().login('admin_root', '1234');
  });
  return caseId;
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
            <AdminHomeScreen />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('AdminHomeScreen — จอ exception-based (§7)', () => {
  it('เรื่องที่ลูกค้าแจ้งโผล่ทั้งในรายการที่ต้องจัดการและคิวคืนเงิน', async () => {
    const caseId = await disputeAsCustomer();
    const result = render();
    await flush();

    expect(findAll(result.root, 'stack-admin').length).toBe(1);
    expect(findAny(result.root, `refund-${caseId}`).length).toBeGreaterThanOrEqual(1);
    expect(findAny(result.root, 'admin-metrics').length).toBeGreaterThanOrEqual(1);
  });

  /** §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ — ต้องมีเหตุผลให้อ่านและมียอดที่เสนอ */
  it('โชว์ข้อเสนอพร้อมเหตุผล ไม่ใช่ปุ่มคืนเงินเปล่า ๆ', async () => {
    const caseId = await disputeAsCustomer();
    const result = render();
    await flush();

    expect(findAll(result.root, `refund-suggested-${caseId}`).length).toBe(1);
    const texts = result.root
      .findAll((n) => typeof n.type === 'string' && n.props?.children !== undefined)
      .map((n) => String(n.props.children));
    expect(texts.some((s) => s.includes('เสนอคืนเต็มจำนวน'))).toBe(true);
  });

  it('แอดมินกดยืนยันครั้งเดียวแล้วเรื่องหลุดจากคิว', async () => {
    const caseId = await disputeAsCustomer();
    const result = render();
    await flush();

    await act(async () => {
      findAny(result.root, `btn-approve-${caseId}`)[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `refund-${caseId}`).length).toBe(0);
    const cases = await repos.admin.openRefunds();
    expect(cases.some((c) => c.id === caseId)).toBe(false);
  });

  /**
   * เรื่องที่ระบบตัดสินไม่ได้ต้องกดอนุมัติรวดเดียวไม่ได้
   * ไม่งั้นแอดมินจะกดผ่านทั้งที่ยังไม่รู้ว่าใครรับผิดชอบและควรคืนเท่าไหร่
   */
  it('เรื่องที่ระบบไม่เสนอยอด กดอนุมัติรวดเดียวไม่ได้', async () => {
    const caseId = await disputeAsCustomer('other');
    const result = render();
    await flush();

    expect(findAll(result.root, `refund-needs-review-${caseId}`).length).toBe(1);
    const approve = findAny(result.root, `btn-approve-${caseId}`)[0];
    expect(approve.props.disabled).toBe(true);
  });

  it('กดปฏิเสธได้แม้ระบบยังไม่เสนอยอด', async () => {
    const caseId = await disputeAsCustomer('other');
    const result = render();
    await flush();

    await act(async () => {
      findAny(result.root, `btn-reject-${caseId}`)[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `refund-${caseId}`).length).toBe(0);
  });
});
