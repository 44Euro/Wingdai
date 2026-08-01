import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { EditProfileScreen } from '../../src/features/customer/screens/EditProfileScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';

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
function textOf(root: ReactTestRenderer.ReactTestInstance, id: string): string {
  return findAll(root, id)
    .flatMap((n) => n.findAll((c) => typeof c.type === 'string' && typeof c.props?.children === 'string'))
    .map((n) => String(n.props.children))
    .join(' ');
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
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
            <EditProfileScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ key: 'k', name: 'EditProfile' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

async function loginAsSomchai() {
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
  });
}

describe('EditProfileScreen — แก้โปรไฟล์ (C21)', () => {
  it('ยังไม่แก้อะไร กดบันทึกไม่ได้', async () => {
    await loginAsSomchai();
    const result = render();
    await flush();

    expect(findAll(result.root, 'screen-edit-profile').length).toBe(1);
    expect(findAny(result.root, 'btn-save-profile')[0].props.disabled).toBe(true);
  });

  it('แก้ชื่อแล้วบันทึก ชื่อในสโตร์เปลี่ยนตาม', async () => {
    await loginAsSomchai();
    const result = render();
    await flush();

    act(() => {
      findAny(result.root, 'input-full-name')[0].props.onChangeText('สมชาย ใจกล้า');
    });
    expect(findAny(result.root, 'btn-save-profile')[0].props.disabled).toBe(false);

    await act(async () => {
      findAny(result.root, 'btn-save-profile')[0].props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'profile-saved').length).toBe(1);
    expect(useAuthStore.getState().account?.fullName).toBe('สมชาย ใจกล้า');
  });

  /**
   * claude.md §4.2 — เบอร์ผ่าน OTP มาแล้ว และ username คือ identifier ที่ใช้ล็อกอิน
   * ทั้งคู่ต้องโชว์ให้เห็นพร้อมเหตุผล ไม่ใช่หายไปเฉย ๆ จนผู้ใช้หาไม่เจอ
   */
  it('ชื่อผู้ใช้กับเบอร์โชว์แบบอ่านอย่างเดียว ไม่มีช่องให้แก้', async () => {
    await loginAsSomchai();
    const result = render();
    await flush();

    expect(textOf(result.root, 'readonly-username')).toBe('somchai');
    expect(findAll(result.root, 'readonly-phone').length).toBe(1);
    // ไม่มีช่องกรอกสำหรับสองอย่างนี้เลย
    expect(findAny(result.root, 'input-username').length).toBe(0);
    expect(findAny(result.root, 'input-phone').length).toBe(0);
  });

  it('อีเมลผิดรูปแบบ กดบันทึกไม่ได้', async () => {
    await loginAsSomchai();
    const result = render();
    await flush();

    act(() => {
      findAny(result.root, 'input-email')[0].props.onChangeText('ไม่ใช่อีเมล');
    });
    expect(findAny(result.root, 'btn-save-profile')[0].props.disabled).toBe(true);
  });

  /** อีเมลเป็นช่องเลือกได้ (§4.2) — ลบออกต้องทำได้ ไม่ใช่ติดอยู่ตลอดชีวิตบัญชี */
  it('ลบอีเมลออกได้', async () => {
    await loginAsSomchai();
    await act(async () => {
      await useAuthStore.getState().updateProfile({ fullName: 'สมชาย ใจดี', email: 'a@b.co' });
    });
    const result = render();
    await flush();

    act(() => {
      findAny(result.root, 'input-email')[0].props.onChangeText('');
    });
    await act(async () => {
      findAny(result.root, 'btn-save-profile')[0].props.onPress();
    });
    await flush();

    expect(useAuthStore.getState().account?.email).toBeUndefined();
  });
});
