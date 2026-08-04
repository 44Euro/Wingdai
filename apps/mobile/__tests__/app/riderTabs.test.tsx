import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderStack } from '../../src/app/navigators/RiderStack';
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
  if (!node) throw new Error(`ไม่พบแท็บที่กดได้: ${id}`);
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

/** เรนเดอร์ RiderStack ทั้งก้อนจริง ๆ */
function render() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  act(() => {
    r?.unmount();
  });
  client?.clear();
  client = qc;
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <RiderStack />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const TABS = ['RiderHome', 'RiderEarnings', 'RiderPayout', 'RiderProfile'];

describe('แท็บบาร์ไรเดอร์', () => {
  beforeEach(async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
  });

  it('มีครบสี่แท็บ', async () => {
    const result = render();
    await flush();

    for (const name of TABS) {
      expect(findAll(result.root, `rider-tab-${name}`).length).toBe(1);
    }
  });

  it('เปิดมาอยู่ที่หน้าแรก', async () => {
    const result = render();
    await flush();

    expect(findAll(result.root, 'screen-rider-home').length).toBe(1);
  });

  /** กดแท็บต้องเปลี่ยนจอจริง ไม่ใช่แค่ปุ่มเปลี่ยนสี */
  it('กดแท็บรายได้แล้วเปลี่ยนไปจอรายได้จริง', async () => {
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'rider-tab-RiderEarnings').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'screen-rider-earnings').length).toBe(1);
  });

  it('กดแท็บถอนเงินแล้วเปลี่ยนไปจอถอนเงินจริง', async () => {
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'rider-tab-RiderPayout').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'screen-rider-payout').length).toBe(1);
  });

  it('กดแท็บโปรไฟล์แล้วเปลี่ยนไปจอโปรไฟล์จริง', async () => {
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'rider-tab-RiderProfile').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'screen-rider-profile').length).toBe(1);
  });

  /** กลับมาแท็บเดิมได้ ไม่ใช่ทางเดียว */
  it('กดกลับมาแท็บหน้าแรกได้', async () => {
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'rider-tab-RiderProfile').props.onPress();
    });
    await flush();
    await act(async () => {
      pressable(result.root, 'rider-tab-RiderHome').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'screen-rider-home').length).toBe(1);
  });

  /** จอโปรไฟล์คือที่อยู่ใหม่ของตัวสลับโหมดกับจุดตั้งทำงาน */
  it('จอโปรไฟล์มีจุดตั้งทำงานและปุ่มออกจากระบบ', async () => {
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'rider-tab-RiderProfile').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'btn-rider-base').length).toBe(1);
    expect(findAll(result.root, 'btn-logout').length).toBe(1);
  });
});
