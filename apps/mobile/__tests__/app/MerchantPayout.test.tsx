import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { MerchantPayoutScreen } from '../../src/features/merchant/screens/MerchantPayoutScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

function render(restaurantId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReturnType<typeof ReactTestRenderer.create>;
  act(() => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <NavigationContainer>
            <MerchantPayoutScreen
              navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
              route={{ params: { restaurantId } } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return tree;
}

/** react-test-renderer คืนทั้ง composite และ host ที่มี testID เดียวกัน เอาเฉพาะ host */
const find = (tree: ReturnType<typeof ReactTestRenderer.create>, id: string) =>
  tree.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');

describe('MerchantPayoutScreen — ร้านขอถอนเงิน (§6.2)', () => {
  beforeEach(async () => {
    await act(async () => { await useAuthStore.getState().login('malee', '1234'); });
  });

  it('โชว์ยอดที่ถอนได้ ไม่ใช่ยอดขายรวม', async () => {
    const [shop] = await repos.merchant.myRestaurants();
    const tree = render(shop!.id);
    await flush();
    expect(find(tree, 'screen-merchant-payout').length).toBeGreaterThan(0);
    expect(find(tree, 'payout-available').length).toBeGreaterThan(0);
  });

  it('ยังไม่เคยขอถอน ต้องบอกว่าว่าง ไม่ใช่จอเปล่า', async () => {
    const [shop] = await repos.merchant.myRestaurants();
    const tree = render(shop!.id);
    await flush();
    expect(find(tree, 'payout-empty').length).toBe(1);
  });

  it('ขอเกินยอดที่มีไม่ได้ ปุ่มต้องกดไม่ลง', async () => {
    const [shop] = await repos.merchant.myRestaurants();
    const tree = render(shop!.id);
    await flush();

    const [input] = tree.root.findAll(
      (n) => n.props?.testID === 'input-payout-amount' && typeof n.props?.onChangeText === 'function',
    );
    act(() => input!.props.onChangeText('999999'));

    const [btn] = tree.root.findAll(
      (n) => n.props?.testID === 'btn-request-payout' && n.props?.disabled !== undefined,
    );
    expect(btn!.props.disabled).toBe(true);
  });
});
