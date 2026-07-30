import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { initI18n } from '../src/i18n';

// @testing-library/react-native ถูกถอดออกจากโปรเจกต์ (ใช้ไม่ได้กับ jest-expo 57 + React 19)
// ใช้ react-test-renderer ตรง ๆ ตามรูปแบบใน __tests__/app/RootNavigator.test.tsx แทน

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

describe('App', () => {
  it('เปิดแอปแล้วไม่ crash และสุดท้ายเห็นหน้าเข้าสู่ระบบ', async () => {
    // App.tsx มี useEffect ที่เรียก initI18n() แบบ async แล้วค่อย setReady(true)
    // ห่อการ render ใน act(async => {...}) เพื่อให้ effect เริ่มทำงาน
    await act(async () => {
      currentRenderer = ReactTestRenderer.create(<App />);
    });

    /*
     * ต้องรอถึงระดับ timer ไม่ใช่แค่ microtask เพราะมีสองอย่างที่ต้องเสร็จก่อนจอแรกจะโผล่:
     *   1. initI18n().then(setReady) — microtask
     *   2. RootNavigator เช็คว่ามีเซสชันค้างอยู่ไหม ซึ่งวิ่งผ่าน repo (มี setTimeout ข้างใน)
     *
     * ข้อสองเป็นของใหม่ และตั้งใจให้ไม่วาดอะไรเลยระหว่างรอ — ถ้าวาดจอล็อกอินไปก่อน
     * มันจะแวบขึ้นมาแล้วหายไปเองทุกครั้งที่เปิดแอปของคนที่ล็อกอินอยู่
     */
    for (let i = 0; i < 10; i += 1) {
      const found = findAllByTestId(currentRenderer!.root, 'screen-login');
      if (found.length > 0) break;
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((res) => setTimeout(res, 5));
      });
    }

    const found = findAllByTestId(currentRenderer!.root, 'screen-login');
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});
