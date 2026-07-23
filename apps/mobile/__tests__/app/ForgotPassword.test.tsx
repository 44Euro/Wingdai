import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ForgotPasswordScreen } from '../../src/app/navigators/ForgotPasswordScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import type { AuthStackParamList } from '../../src/app/navigators/AuthNavigator';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
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

/** เอา node แรกที่ตรง testID มาใช้เรียก props (onPress/onChangeText) */
function getFirstByTestId(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  const nodes = findAllByTestId(root, testID);
  if (nodes.length === 0) throw new Error(`ไม่พบ testID: ${testID}`);
  return nodes[0];
}

function getErrorText(root: ReactTestRenderer.ReactTestInstance): string | undefined {
  const nodes = findAllByTestId(root, 'forgot-error');
  const withChildren = nodes.find((n) => typeof n.props.children === 'string');
  return withChildren?.props.children as string | undefined;
}

function getSentText(root: ReactTestRenderer.ReactTestInstance): string | undefined {
  const nodes = findAllByTestId(root, 'forgot-sent');
  const withChildren = nodes.find((n) => typeof n.props.children === 'string');
  return withChildren?.props.children as string | undefined;
}

function renderForgotPassword(navigation: { navigate: jest.Mock; goBack: jest.Mock }) {
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <ForgotPasswordScreen
          navigation={
            navigation as unknown as NativeStackNavigationProp<
              AuthStackParamList,
              'ForgotPassword'
            >
          }
        />
      </ThemeProvider>,
    );
  });
  return currentRenderer!;
}

describe('ForgotPasswordScreen', () => {
  it('กรอกเบอร์โทร "123" (ผิดรูปแบบ) → ขึ้น error เบอร์โทรผิดรูปแบบ, ไม่มี forgot-sent', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderForgotPassword({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'input-phone').props.onChangeText('123');
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-send-reset').props.onPress();
    });

    expect(getErrorText(result.root)).toBe(i18n.t('auth.register.phoneInvalid'));
    expect(getSentText(result.root)).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('กรอกเบอร์โทร "0812345678" (ถูกรูปแบบ) → มี forgot-sent, ไม่มี forgot-error', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderForgotPassword({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'input-phone').props.onChangeText('0812345678');
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-send-reset').props.onPress();
    });

    expect(getSentText(result.root)).toBe(i18n.t('auth.forgot.sent'));
    expect(getErrorText(result.root)).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('เบอร์โทรว่าง → กดปุ่มส่ง → ขึ้น error เบอร์โทรผิดรูปแบบ', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderForgotPassword({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'btn-send-reset').props.onPress();
    });

    expect(getErrorText(result.root)).toBe(i18n.t('auth.register.phoneInvalid'));
    expect(getSentText(result.root)).toBeUndefined();
  });

  it('กดปุ่มกลับ → เรียก navigation.goBack()', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderForgotPassword({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'link-back-login').props.onPress();
    });

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
