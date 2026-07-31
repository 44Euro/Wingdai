import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { AdminHomeScreen } from '../../src/features/admin/screens/AdminHomeScreen';
import { AdminMoneyScreen } from '../../src/features/admin/screens/AdminMoneyScreen';
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

/** ลูกค้าสั่ง → ส่งถึง → แจ้งปัญหา แล้วสลับเป็นแอดมิน */
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

const nav = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen(node: React.ReactElement) {
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
          <NavigationContainer>{node}</NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const renderHome = () => renderScreen(
  <AdminHomeScreen navigation={nav as never} route={{ key: 'k', name: 'AdminHome' } as never} />,
);
const renderMoney = () => renderScreen(<AdminMoneyScreen />);

describe('AdminHomeScreen — AD1 "อะไรกำลังไหม้"', () => {
  it('โชว์ตัวเลขสด ตัวเลขย้อนหลัง และคิวที่ต้องจัดการ', async () => {
    await disputeAsCustomer();
    const result = renderHome();
    await flush();

    expect(findAll(result.root, 'stack-admin').length).toBe(1);
    expect(findAny(result.root, 'admin-live-ops').length).toBeGreaterThanOrEqual(1);
    expect(findAny(result.root, 'admin-metrics').length).toBeGreaterThanOrEqual(1);
  });

  /** §7 จอหลักของแอดมินคือคิว exception ไม่ใช่ที่รวมทุกอย่าง */
  it('ไม่เอาเคสคืนเงินมากองรวมที่จอแรก', async () => {
    const caseId = await disputeAsCustomer();
    const result = renderHome();
    await flush();

    expect(findAny(result.root, `refund-${caseId}`).length).toBe(0);
  });

  it('ปุ่มเปิดแผนที่พาไปจอแผนที่จริง', async () => {
    const result = renderHome();
    await flush();

    await act(async () => {
      findAny(result.root, 'btn-ops-map')[0].props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('AdminMap');
  });
});

describe('AdminMoneyScreen — AD5 + AD7 "เงินไปไหน"', () => {
  /** §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ ต้องมีเหตุผลให้อ่านและมียอดที่เสนอ */
  it('โชว์ข้อเสนอพร้อมเหตุผล ไม่ใช่ปุ่มคืนเงินเปล่า ๆ', async () => {
    const caseId = await disputeAsCustomer();
    const result = renderMoney();
    await flush();

    expect(findAll(result.root, `refund-suggested-${caseId}`).length).toBe(1);
    const texts = result.root
      .findAll((n) => typeof n.type === 'string' && n.props?.children !== undefined)
      .map((n) => String(n.props.children));
    expect(texts.some((s) => s.includes('เสนอคืนเต็มจำนวน'))).toBe(true);
  });

  it('แอดมินกดยืนยันครั้งเดียวแล้วเรื่องหลุดจากคิว', async () => {
    const caseId = await disputeAsCustomer();
    const result = renderMoney();
    await flush();

    await act(async () => {
      findAny(result.root, `btn-approve-${caseId}`)[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `refund-${caseId}`).length).toBe(0);
    const cases = await repos.admin.openRefunds();
    expect(cases.some((c) => c.id === caseId)).toBe(false);
  });

  /** เรื่องที่ระบบตัดสินไม่ได้ต้องกดอนุมัติรวดเดียวไม่ได้ */
  it('เรื่องที่ระบบไม่เสนอยอด กดอนุมัติรวดเดียวไม่ได้', async () => {
    const caseId = await disputeAsCustomer('other');
    const result = renderMoney();
    await flush();

    expect(findAll(result.root, `refund-needs-review-${caseId}`).length).toBe(1);
    const approve = findAny(result.root, `btn-approve-${caseId}`)[0];
    expect(approve.props.disabled).toBe(true);
  });

  it('กดปฏิเสธได้แม้ระบบยังไม่เสนอยอด', async () => {
    const caseId = await disputeAsCustomer('other');
    const result = renderMoney();
    await flush();

    await act(async () => {
      findAny(result.root, `btn-reject-${caseId}`)[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `refund-${caseId}`).length).toBe(0);
  });

  /** รอบจ่ายร้าน (AD7) ยอดต้องหักคืนเงินที่เป็นความผิดของร้านแล้ว */
  it('ยอดค้างจ่ายร้านหักคืนเงินที่ร้านรับผิดชอบแล้ว', async () => {
    const caseId = await disputeAsCustomer();
    const before = (await repos.admin.restaurantPayables())
      .find((p) => p.restaurantId === 'r-malee')!.payableSatang;

    await act(async () => {
      await repos.admin.decideRefund(caseId, { approve: true });
    });

    const after = (await repos.admin.restaurantPayables())
      .find((p) => p.restaurantId === 'r-malee')!.payableSatang;
    expect(after).toBeLessThan(before);
  });

  it('กดจ่ายร้านแล้วยอดหายไปจากรายการ กดซ้ำไม่ได้', async () => {
    await disputeAsCustomer();
    const result = renderMoney();
    await flush();

    const payables = await repos.admin.restaurantPayables();
    const shop = payables.find((p) => p.restaurantId === 'r-malee')!;
    expect(findAny(result.root, `payable-${shop.restaurantId}`).length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      findAny(result.root, `btn-settle-${shop.restaurantId}`)[0].props.onPress();
    });
    await flush();

    const after = await repos.admin.restaurantPayables();
    expect(after.some((p) => p.restaurantId === shop.restaurantId)).toBe(false);
    await expect(repos.admin.settleRestaurant(shop.restaurantId)).rejects.toThrow();
  });
});

/** ไรเดอร์ส่งงานจนมีรายได้ → ขอถอน → สลับเป็นแอดมิน */
async function payoutRequestedByRider() {
  let payoutId = '';
  let amount = 0;
  await act(async () => {
    /** mock เป็น singleton ระดับโมดูล สถานะจึงข้ามเทสต์ในไฟล์เดียวกัน เคลียร์คำขอที่ค้าง */
    await useAuthStore.getState().login('admin_root', '1234');
    for (const stale of await repos.admin.riderPayouts()) {
      // eslint-disable-next-line no-await-in-loop
      await repos.admin.decideRiderPayout(stale.id, {
        approve: false, rejectionReason: 'เคลียร์สถานะค้างจากเทสต์ก่อนหน้า',
      });
    }

    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    await repos.orders.updateStatus(order.id, 'accepted');

    await useAuthStore.getState().login('rider_ann', '1234');
    await repos.rider.acceptOffer(order.id);
    await repos.orders.updateStatus(order.id, 'preparing');
    await repos.orders.updateStatus(order.id, 'picked_up');
    await repos.orders.updateStatus(order.id, 'delivered', {
      deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg',
    });

    const balance = await repos.rider.balance();
    amount = balance.withdrawableSatang;
    payoutId = (await repos.rider.requestPayout(amount)).id;

    await useAuthStore.getState().login('admin_root', '1234');
  });
  return { payoutId, amount };
}

/** R12 ครึ่งหลัง ก่อนหน้านี้ไรเดอร์กดขอถอนได้ แต่ไม่มีจอไหนอนุมัติได้เลย */
describe('AdminMoneyScreen — คำขอถอนของไรเดอร์ (R12)', () => {
  it('คำขอโผล่ในคิวพร้อมชื่อและยอด', async () => {
    const { payoutId } = await payoutRequestedByRider();
    const result = renderMoney();
    await flush();

    expect(findAny(result.root, `payout-${payoutId}`).length).toBeGreaterThanOrEqual(1);
    expect(findAny(result.root, 'admin-no-payouts').length).toBe(0);
  });

  it('กดยืนยันแล้วคำขอหลุดจากคิว และรายได้ค้างจ่ายของไรเดอร์ลดลงจริง', async () => {
    const { payoutId, amount } = await payoutRequestedByRider();
    const result = renderMoney();
    await flush();

    await act(async () => {
      findAny(result.root, `btn-approve-payout-${payoutId}`)[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `payout-${payoutId}`).length).toBe(0);
    expect((await repos.admin.riderPayouts()).some((p) => p.id === payoutId)).toBe(false);

    // §6.2 ยืนยันแล้วเงินออกจริง ยอดค้างจ่ายต้องลดลงเท่าที่จ่าย ไม่ใช่แค่คำขอหายไป
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    const after = await repos.rider.balance();
    expect(after.pending).toBeNull();
    expect(after.payableSatang).toBe(0);
    expect(amount).toBeGreaterThan(0);
  });

  /** ไรเดอร์ต้องรู้ว่าทำไมเงินไม่ออก ไม่ใช่เห็นคำขอหายไปเฉย ๆ */
  it('ยังไม่กรอกเหตุผล ปฏิเสธไม่ได้', async () => {
    const { payoutId } = await payoutRequestedByRider();
    const result = renderMoney();
    await flush();

    expect(findAny(result.root, `btn-reject-payout-${payoutId}`)[0].props.disabled).toBe(true);
  });

  it('ปฏิเสธพร้อมเหตุผลแล้วคำขอหลุดจากคิว และไรเดอร์ขอใหม่ได้', async () => {
    const { payoutId, amount } = await payoutRequestedByRider();
    const result = renderMoney();
    await flush();

    await act(async () => {
      findAny(result.root, `input-payout-reason-${payoutId}`)[0].props.onChangeText('เลขบัญชีไม่ตรงชื่อ');
    });
    await flush();
    await act(async () => {
      findAny(result.root, `btn-reject-payout-${payoutId}`)[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, `payout-${payoutId}`).length).toBe(0);

    // ปฏิเสธแล้วเงินต้องไม่ออก ยอดยังอยู่ครบ และไรเดอร์ขอใหม่ได้
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    const after = await repos.rider.balance();
    expect(after.pending).toBeNull();
    expect(after.withdrawableSatang).toBe(amount);
    await expect(repos.rider.requestPayout(amount)).resolves.toBeTruthy();
  });
});
