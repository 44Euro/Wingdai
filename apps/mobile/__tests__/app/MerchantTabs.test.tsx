import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { MerchantStack } from '../../src/app/navigators/MerchantStack';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';

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
});

function findAny(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

async function renderAsOwner() {
  await act(async () => {
    await useAuthStore.getState().login('malee', '1234');
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <MerchantStack />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
  return r!;
}

async function tapTab(result: ReactTestRenderer.ReactTestRenderer, name: string) {
  await act(async () => {
    findAny(result.root, `merchant-tab-${name}`)[0].props.onPress();
  });
  await flush();
}

describe('แถบแท็บของฝั่งร้าน', () => {
  it('เปิดโหมดร้านแล้วเจอคิวออเดอร์เป็นแท็บแรก', async () => {
    const result = await renderAsOwner();
    expect(findAny(result.root, 'screen-merchant-orders').length).toBeGreaterThanOrEqual(1);
  });

  it('มีครบสี่แท็บ ไม่ต้องเดาว่าเมนูกับยอดขายซ่อนอยู่ไหน', async () => {
    const result = await renderAsOwner();
    for (const name of ['MerchantOrders', 'MerchantMenu', 'MerchantSummary', 'MerchantProfile']) {
      expect(findAny(result.root, `merchant-tab-${name}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('ไปจอเมนูและจอยอดขายได้จากแถบแท็บ', async () => {
    const result = await renderAsOwner();

    await tapTab(result, 'MerchantMenu');
    expect(findAny(result.root, 'screen-merchant-menu').length).toBeGreaterThanOrEqual(1);

    await tapTab(result, 'MerchantSummary');
    expect(findAny(result.root, 'screen-merchant-summary').length).toBeGreaterThanOrEqual(1);
  });

  // เดิม logout ซ่อนอยู่ท้ายจอจัดการเมนู ซึ่งไม่มีใครไปหา
  it('แท็บร้านของฉันมีทั้งปุ่มออกจากระบบและตัวสลับโหมด', async () => {
    const result = await renderAsOwner();
    await tapTab(result, 'MerchantProfile');

    expect(findAny(result.root, 'screen-merchant-profile').length).toBeGreaterThanOrEqual(1);
    expect(findAny(result.root, 'btn-logout').length).toBeGreaterThanOrEqual(1);
    expect(findAny(result.root, 'role-switcher').length).toBeGreaterThanOrEqual(1);
  });

  it('เจ้าของร้านที่เป็นลูกค้าด้วย สลับกลับไปโหมดลูกค้าได้', async () => {
    const result = await renderAsOwner();
    await tapTab(result, 'MerchantProfile');

    await act(async () => {
      findAny(result.root, 'role-card-customer')[0].props.onPress();
    });
    await act(async () => {
      findAny(result.root, 'confirm-switch-role')[0].props.onPress();
    });

    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('กดออกจากระบบแล้วเซสชันหลุดจริง', async () => {
    const result = await renderAsOwner();
    await tapTab(result, 'MerchantProfile');

    await act(async () => {
      await findAny(result.root, 'btn-logout')[0].props.onPress();
    });
    await flush();

    expect(useAuthStore.getState().account).toBeNull();
  });
});
