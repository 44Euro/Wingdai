import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AppIntroScreen } from '../../src/features/onboarding/AppIntroScreen';
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
  useOnboardingStore.setState({ introSeen: false, permissionsAsked: false });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id)[0];
}

function render(replace = jest.fn()) {
  act(() => {
    r = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <AppIntroScreen
          navigation={{ replace } as never}
          route={{ key: 'k', name: 'AppIntro', params: undefined } as never}
        />
      </ThemeProvider>,
    );
  });
  return { result: r!, replace };
}

describe('A6 จอแนะนำแอปครั้งแรก', () => {
  it('มีสามหน้า กดถัดไปแล้วเนื้อหาเปลี่ยน', () => {
    const { result } = render();
    const first = find(result.root, 'intro-title').props.children;

    act(() => find(result.root, 'btn-intro-next').props.onPress());
    expect(find(result.root, 'intro-title').props.children).not.toBe(first);
  });

  it('ถึงหน้าสุดท้ายแล้วกดต่อ เข้าจอเข้าสู่ระบบและไม่ต้องดูอีก', () => {
    const { result, replace } = render();

    act(() => find(result.root, 'btn-intro-next').props.onPress());
    act(() => find(result.root, 'btn-intro-next').props.onPress());
    act(() => find(result.root, 'btn-intro-next').props.onPress());

    expect(replace).toHaveBeenCalledWith('Login');
    expect(useOnboardingStore.getState().introSeen).toBe(true);
  });

  it('กดข้ามได้ทุกหน้า ไม่ต้องดูจนจบ', () => {
    const { result, replace } = render();

    act(() => find(result.root, 'btn-intro-skip').props.onPress());

    expect(replace).toHaveBeenCalledWith('Login');
    expect(useOnboardingStore.getState().introSeen).toBe(true);
  });

  it('จุดบอกตำแหน่งเท่าจำนวนหน้า', () => {
    const { result } = render();
    expect(result.root.findAll((n) => typeof n.type === 'string'
      && typeof n.props?.testID === 'string'
      && n.props.testID.startsWith('intro-dot-'))).toHaveLength(3);
  });
});
