import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { MerchantStack } from '../../src/app/navigators/MerchantStack';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';

beforeAll(async () => {
  await initI18n();
});
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('th');
  });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((res) => setTimeout(res, 5)); });
  }
}

/** malee เป็นบัญชีธรรมดาที่มีร้าน จึงมีทั้งความสามารถลูกค้าและร้าน */
async function loginAsMerchant() {
  await act(async () => {
    await useAuthStore.getState().login('malee', '1234');
  });
  act(() => {
    useAuthStore.getState().setActiveCapability('merchant');
  });
}

async function render() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => {
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

describe('การเดินทางในโหมดร้าน', () => {
  it('มีแถบแท็บเหมือนบทบาทอื่น ไม่ใช่จอเดี่ยวที่ออกไปไหนไม่ได้', async () => {
    await loginAsMerchant();
    const result = await render();

    expect(find(result.root, 'merchant-tab-bar').length).toBeGreaterThanOrEqual(1);
    for (const tab of ['MerchantOrders', 'MerchantMenu', 'MerchantSummary', 'MerchantProfile']) {
      expect(find(result.root, `merchant-tab-${tab}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('เข้าแท็บร้านของฉันแล้วออกจากระบบได้', async () => {
    await loginAsMerchant();
    const result = await render();

    await act(async () => {
      find(result.root, 'merchant-tab-MerchantProfile')[0].props.onPress();
    });
    await flush();

    expect(find(result.root, 'screen-merchant-profile').length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      find(result.root, 'btn-logout')[0].props.onPress();
    });
    await flush();

    expect(useAuthStore.getState().account).toBeNull();
  });

  it('สลับกลับไปโหมดลูกค้าได้จากแท็บร้านของฉัน', async () => {
    await loginAsMerchant();
    const result = await render();

    await act(async () => {
      find(result.root, 'merchant-tab-MerchantProfile')[0].props.onPress();
    });
    await flush();

    await act(async () => {
      find(result.root, 'role-card-customer')[0].props.onPress();
    });
    await act(async () => {
      find(result.root, 'confirm-switch-role')[0].props.onPress();
    });

    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('คิวออเดอร์ไม่มีปุ่มลัดบนหัวจอแล้ว เพราะย้ายไปอยู่บนแท็บ', async () => {
    await loginAsMerchant();
    const result = await render();

    expect(find(result.root, 'btn-go-summary')).toHaveLength(0);
    expect(find(result.root, 'btn-go-menu')).toHaveLength(0);
  });
});
