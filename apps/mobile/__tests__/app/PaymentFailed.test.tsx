import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PaymentFailedScreen } from '../../src/features/customer/screens/PaymentFailedScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { usePaymentStore } from '../../src/features/payment/paymentStore';

beforeAll(async () => {
  await initI18n();
});
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('th');
  });
  usePaymentStore.setState({ method: 'promptpay', available: ['promptpay', 'card'] });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id)[0];
}

function render(params?: { orderId?: string }) {
  const replace = jest.fn();
  act(() => {
    r = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <PaymentFailedScreen
          navigation={{ replace, goBack: jest.fn() } as never}
          route={{ key: 'k', name: 'PaymentFailed', params } as never}
        />
      </ThemeProvider>,
    );
  });
  return { result: r!, replace };
}

describe('SY4 จอจ่ายเงินไม่สำเร็จ', () => {
  it('บอกว่าเงินยังไม่ถูกตัดและตะกร้ายังอยู่ ไม่ใช่แค่บอกว่าล้มเหลว', () => {
    const { result } = render();
    const body = String(find(result.root, 'payfail-body').props.children);
    expect(body).toContain('ยังไม่ถูกตัด');
    expect(body).toContain('ตะกร้า');
  });

  it('กดลองใหม่กลับไปจ่ายด้วยวิธีเดิม', () => {
    usePaymentStore.setState({ method: 'promptpay' });
    const { result, replace } = render();

    act(() => find(result.root, 'btn-payfail-retry').props.onPress());
    expect(replace).toHaveBeenCalledWith('PromptPay');
  });

  it('คนที่เลือกจ่ายด้วยบัตร กดลองใหม่ต้องกลับไปจอบัตร ไม่ใช่จอพร้อมเพย์', () => {
    usePaymentStore.setState({ method: 'card' });
    const { result, replace } = render();

    act(() => find(result.root, 'btn-payfail-retry').props.onPress());
    expect(replace).toHaveBeenCalledWith('CardPay');
  });

  it('จ่ายออร์เดอร์ที่ค้างอยู่ กดลองใหม่ต้องกลับไปจ่ายใบเดิม ไม่ใช่เริ่มสั่งจากตะกร้าใหม่', () => {
    usePaymentStore.setState({ method: 'card' });
    const { result, replace } = render({ orderId: 'o-1' });

    act(() => find(result.root, 'btn-payfail-retry').props.onPress());
    expect(replace).toHaveBeenCalledWith('PromptPay', { orderId: 'o-1' });
  });

  it('กดเปลี่ยนวิธีจ่ายไปจอเลือกวิธีจ่าย', () => {
    const { result, replace } = render();

    act(() => find(result.root, 'btn-payfail-change').props.onPress());
    expect(replace).toHaveBeenCalledWith('PaymentMethod');
  });
});
