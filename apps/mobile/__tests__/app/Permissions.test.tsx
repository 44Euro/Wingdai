import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import * as Location from 'expo-location';
import { PermissionsScreen } from '../../src/features/onboarding/PermissionsScreen';
import { useOnboardingStore } from '../../src/features/onboarding/onboardingStore';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';

beforeAll(async () => {
  await initI18n();
});
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('th');
  });
  useOnboardingStore.setState({ introSeen: true, permissionsAsked: false });
  jest.clearAllMocks();
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id)[0];
}

function render() {
  const replace = jest.fn();
  act(() => {
    r = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <PermissionsScreen
          navigation={{ replace } as never}
          route={{ key: 'k', name: 'Permissions', params: undefined } as never}
        />
      </ThemeProvider>,
    );
  });
  return { result: r!, replace };
}

describe('C30 จอขออนุญาต', () => {
  it('กดอนุญาตแล้วขอสิทธิ์ตำแหน่งของจริง', async () => {
    const { result, replace } = render();

    await act(async () => {
      await find(result.root, 'btn-permissions-allow').props.onPress();
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('Tabs');
  });

  it('กดไว้ทีหลังแล้วเข้าแอปได้ โดยไม่ไปรบกวนขอสิทธิ์', async () => {
    const { result, replace } = render();

    await act(async () => {
      await find(result.root, 'btn-permissions-skip').props.onPress();
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('Tabs');
  });

  it('ผู้ใช้ปฏิเสธสิทธิ์ตำแหน่ง ก็ยังต้องเข้าแอปได้ ไม่ค้างอยู่ที่จอนี้', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    const { result, replace } = render();

    await act(async () => {
      await find(result.root, 'btn-permissions-allow').props.onPress();
    });

    expect(replace).toHaveBeenCalledWith('Tabs');
  });

  it('ถามแล้วจำไว้ ไม่ถามซ้ำรอบหน้า', async () => {
    const { result } = render();

    await act(async () => {
      await find(result.root, 'btn-permissions-skip').props.onPress();
    });

    expect(useOnboardingStore.getState().permissionsAsked).toBe(true);
  });
});
