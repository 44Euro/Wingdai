import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderPayoutScreen } from '../../src/features/rider/screens/RiderPayoutScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';
import { formatBaht } from '../../src/lib/format';

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
function textOf(root: ReactTestRenderer.ReactTestInstance, id: string): string {
  return findAll(root, id)
    .flatMap((n) =>
      n.findAll((c) => typeof c.type === 'string' && typeof c.props?.children === 'string'),
    )
    .map((n) => String(n.props.children))
    .join(' ');
}
/** หา node ที่กดได้จริง Pressable วาง onPress ไว้บน composite ไม่ใช่ host */
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

async function deliver(paymentMethod: 'cash' | 'promptpay') {
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const order = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod,
    });
    await repos.orders.updateStatus(order.id, 'accepted');
    await useAuthStore.getState().login('rider_ann', '1234');
    await repos.rider.acceptOffer(order.id);
    await repos.orders.updateStatus(order.id, 'preparing');
    await repos.orders.updateStatus(order.id, 'picked_up');
    await repos.orders.updateStatus(order.id, 'delivered', { deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg' });
  });
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
            <RiderPayoutScreen />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('RiderPayoutScreen — รายได้และการถอนเงิน (R12)', () => {
  it('ยังไม่เคยส่งงาน ยอดเป็นศูนย์ ไม่มีปุ่มถอน และไม่โชว์บรรทัดเงินสด', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    const result = render();
    await flush();

    expect(findAll(result.root, 'screen-rider-payout').length).toBe(1);
    expect(textOf(result.root, 'payout-withdrawable')).toContain(formatBaht(0));
    expect(pressable(result.root, 'btn-request-payout')).toHaveLength(0);
    // ไม่ถือเงินสดก็ไม่ต้องเห็นบรรทัดที่เป็นศูนย์ตลอดเวลา
    expect(findAll(result.root, 'payout-cash-held')).toHaveLength(0);
  });

  it('ส่งงานพร้อมเพย์แล้วถอนได้ ปุ่มขึ้นพร้อมยอดจริง', async () => {
    await deliver('promptpay');
    const result = render();
    await flush();

    const balance = await repos.rider.balance();
    expect(balance.withdrawableSatang).toBeGreaterThan(0);
    expect(textOf(result.root, 'payout-withdrawable')).toContain(
      formatBaht(balance.withdrawableSatang),
    );
    expect(pressable(result.root, 'btn-request-payout').length).toBeGreaterThan(0);
  });

  /** product-spec §6.2 ถือเงินสดอยู่แล้วยอดถอนติดลบ ปุ่มต้องหายไป */
  it('ส่งงานเงินสดแล้วถอนไม่ได้ จอบอกว่าต้องมีรายได้อีกเท่าไร', async () => {
    await deliver('cash');
    const result = render();
    await flush();

    expect(pressable(result.root, 'btn-request-payout')).toHaveLength(0);
    expect(findAll(result.root, 'payout-blocked').length).toBe(1);
    // บรรทัดเงินสดต้องโผล่ เพราะตอนนี้ถืออยู่จริง
    expect(findAll(result.root, 'payout-cash-held').length).toBe(1);
  });

  it('กดขอถอนแล้วจอเปลี่ยนเป็นรอแอดมินยืนยัน ปุ่มหายไป', async () => {
    /** repos ของ mock เป็นตัวเดียวทั้งไฟล์ เงินสดจากเทสต์ก่อนหน้าจึงค้างมา */
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
      const held = (await repos.rider.balance()).cashHeldSatang;
      if (held > 0) {
        const me = useAuthStore.getState().account!;
        await useAuthStore.getState().login('admin_root', '1234');
        await repos.admin.settleRiderCash(me.id, held);
        await useAuthStore.getState().login('rider_ann', '1234');
      }
    });

    await deliver('promptpay');
    const result = render();
    await flush();

    expect((await repos.rider.balance()).withdrawableSatang).toBeGreaterThan(0);

    const btn = pressable(result.root, 'btn-request-payout')[0]!;
    await act(async () => {
      btn.props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'payout-pending').length).toBe(1);
    expect(pressable(result.root, 'btn-request-payout')).toHaveLength(0);
  });
});
