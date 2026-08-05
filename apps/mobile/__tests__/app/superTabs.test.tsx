import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { SuperAdminStack } from '../../src/app/navigators/SuperAdminStack';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
let client: QueryClient | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  client?.clear();
  client = null;
  r = null;
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = root
    .findAll((n) => n.props?.testID === id)
    .find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error(`ไม่พบสิ่งที่กดได้: ${id}`);
  return node;
}
async function flush() {
  for (let i = 0; i < 15; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

/** เรนเดอร์ stack จริงทั้งก้อน ไม่ mock repo จอที่พังเพราะข้อมูลจริงต้องพังในเทสต์ด้วย */
function render() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  client = qc;
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <SuperAdminStack />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const TABS = ['SuperHome', 'SuperZones', 'SuperConfig', 'SuperAudit'];

describe('แท็บบาร์ซูเปอร์แอดมิน', () => {
  beforeEach(async () => {
    await act(async () => {
      await useAuthStore.getState().login('super_root', '1234');
    });
  });

  it('มีครบสี่แท็บ', async () => {
    const result = render();
    await flush();
    for (const name of TABS) {
      expect(findAll(result.root, `super-tab-${name}`).length).toBe(1);
    }
  });

  it('เปิดมาอยู่ที่ SA1', async () => {
    const result = render();
    await flush();
    expect(findAll(result.root, 'screen-super-home').length).toBe(1);
  });

  it.each([
    ['SuperZones', 'screen-super-zones'],
    ['SuperConfig', 'screen-super-config'],
    ['SuperAudit', 'screen-super-audit'],
  ])('กดแท็บ %s แล้วเปลี่ยนจอจริง', async (tab, screen) => {
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, `super-tab-${tab}`).props.onPress();
    });
    await flush();

    expect(findAll(result.root, screen).length).toBe(1);
  });

  /** SA3 เข้าจาก SA1 ไม่ใช่แท็บ ถ้าปุ่มนี้หาย จะจัดการสิทธิ์ไม่ได้เลยทั้งแอป */
  it('เข้าจอจัดการสิทธิ์จากจอแรกได้', async () => {
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'btn-super-roles').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'screen-super-roles').length).toBe(1);
  });

  /** ซูเปอร์แอดมินต้องกลับไปทำงานแอดมินได้ ไม่งั้นเข้าคิวอนุมัติไม่ได้เลย (สเปค §3.2) */
  it('จอแรกมีตัวสลับโหมดกับปุ่มออกจากระบบ', async () => {
    const result = render();
    await flush();

    expect(findAll(result.root, 'role-switcher').length).toBe(1);
    expect(findAll(result.root, 'role-card-admin').length).toBe(1);
    expect(findAll(result.root, 'btn-logout').length).toBe(1);
  });
});
