import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReceiptScreen } from '../../src/features/customer/screens/ReceiptScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { repos } from '../../src/data';
import type { Order } from '../../src/data/types';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
let qc: QueryClient | null = null;

afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
  qc?.clear();
  qc?.unmount();
  qc = null;
  jest.restoreAllMocks();
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}

function textOf(root: ReactTestRenderer.ReactTestInstance, id: string): string | undefined {
  return findAll(root, id).find((n) => typeof n.props.children === 'string')?.props.children;
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

const order: Order = {
  id: 'o-1',
  reference: 'WD-A7K2M9',
  customerId: 'u-somchai',
  restaurantId: 'r-malee',
  status: 'delivered',
  items: [
    { menuItemId: 'm-1', name: 'ข้าวกะเพรา (ไข่ดาว)', choiceNames: ['ไข่ดาว'], choiceIds: [], unitPrice: 6500, quantity: 2 },
    { menuItemId: 'm-2', name: 'ชาไทยเย็น', choiceNames: [], choiceIds: [], unitPrice: 2500, quantity: 1 },
  ],
  foodTotal: 15500,
  deliveryFee: 1500,
  serviceFee: 500,
  paymentMethod: 'promptpay',
  paymentStatus: 'paid',
  createdAt: '2026-07-30T04:30:00.000Z',
  restaurantLat: 13.7761,
  restaurantLng: 100.545,
  dropoffLat: 13.7815,
  dropoffLng: 100.545,
  riderLocation: null,
  leaveAtDoor: false,
  tipSatang: 0,
  cancelledBy: null,
  cancelReason: null,
};

function render(shown: Order = order) {
  jest.spyOn(repos.orders, 'get').mockResolvedValue(shown);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc!}>
        <ThemeProvider forceScheme="light">
          <ReceiptScreen
            navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
            route={{ key: 'k', name: 'Receipt', params: { orderId: 'o-1' } } as never}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('ReceiptScreen (C14)', () => {
  it('โชว์เลขที่ออร์เดอร์ที่ลูกค้าใช้อ้างได้ ไม่ใช่ uuid', async () => {
    const result = render();
    await flush();
    expect(textOf(result.root, 'receipt-reference')).toBe('WD-A7K2M9');
  });

  /** product-spec §3 ข้อ 2 ค่าอาหาร/ค่าส่ง/ค่าบริการ ต้องแยกบรรทัด ห้ามรวบเป็นก้อนเดียว */
  it('แยกยอดเป็นสามก้อน แล้วรวมท้ายให้ตรง', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'receipt-food-total').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'receipt-delivery-fee').length).toBeGreaterThanOrEqual(1);
    expect(findAll(result.root, 'receipt-service-fee').length).toBeGreaterThanOrEqual(1);
    // 155 + 15 + 5 = 175
    expect(textOf(result.root, 'receipt-total')).toBe('฿175');
  });

  /** คอมมิชชัน 15% เป็นข้อตกลงระหว่างเรากับร้าน ไม่ใช่เรื่องของลูกค้า */
  it('ไม่โชว์ค่าคอมมิชชันบนใบเสร็จของลูกค้า', async () => {
    const result = render();
    await flush();
    const all = JSON.stringify(result.toJSON());
    expect(all).not.toMatch(/คอมมิช|commission|15%/i);
    // 15% ของ 155 = 23.25 ตัวเลขนี้ต้องไม่โผล่ที่ไหนเลย
    expect(all).not.toContain('23.25');
  });

  it('บอกสถานะการชำระเงินตามจริง', async () => {
    const result = render();
    await flush();
    expect(textOf(result.root, 'receipt-payment-status')).toBe('ชำระแล้ว');
  });

  it('ออร์เดอร์เงินสดที่ยังไม่จ่าย บอกว่ายังไม่ได้ชำระ', async () => {
    const result = render({ ...order, paymentMethod: 'cash', paymentStatus: 'pending' });
    await flush();
    expect(textOf(result.root, 'receipt-payment-status')).toBe('ยังไม่ได้ชำระ');
  });
});
