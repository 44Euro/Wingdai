import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { initI18n } from '../src/i18n';
import { useOnboardingStore } from '../src/features/onboarding/onboardingStore';

// @testing-library/react-native ถูกถอดออกจากโปรเจกต์ (ใช้ไม่ได้กับ jest-expo 57 + React 19)

beforeAll(async () => {
  await initI18n();
});

let currentRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    currentRenderer?.unmount();
  });
  currentRenderer = null;
});

/** หา node ทุกตัว (composite + host) ที่มี props.testID ตรงกับที่ระบุ */
function findAllByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
): ReactTestRenderer.ReactTestInstance[] {
  return root.findAll((node) => node.props?.testID === testID);
}

/** ต้องรอถึงระดับ timer ไม่ใช่แค่ microtask เพราะมีหลายอย่างต้องเสร็จก่อนจอแรกจะโผล่ */
async function waitForScreen(testID: string) {
  for (let i = 0; i < 10; i += 1) {
    if (findAllByTestId(currentRenderer!.root, testID).length > 0) break;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
  return findAllByTestId(currentRenderer!.root, testID);
}

async function mount() {
  // App.tsx มี useEffect ที่เรียก initI18n() แบบ async แล้วค่อย setReady(true)
  await act(async () => {
    currentRenderer = ReactTestRenderer.create(<App />);
  });
}

describe('App', () => {
  it('เพิ่งติดตั้งแล้วเปิดครั้งแรก เจอทัวร์แนะนำแอปก่อน', async () => {
    useOnboardingStore.setState({ introSeen: false, permissionsAsked: false, isLoading: false });
    await mount();

    expect((await waitForScreen('screen-app-intro')).length).toBeGreaterThanOrEqual(1);
  });

  it('เคยดูทัวร์แล้ว เปิดมาเจอหน้าเข้าสู่ระบบเลย', async () => {
    useOnboardingStore.setState({ introSeen: true, permissionsAsked: true, isLoading: false });
    await mount();

    expect((await waitForScreen('screen-login')).length).toBeGreaterThanOrEqual(1);
  });
});
