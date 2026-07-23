import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RegisterScreen } from '../../src/app/navigators/RegisterScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import type { AuthStackParamList } from '../../src/app/navigators/AuthNavigator';

// @testing-library/react-native ถูกถอดออกจากโปรเจกต์ ใช้ react-test-renderer ตรง ๆ

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

/** เอา node แรกที่ตรง testID มาใช้เรียก props (onPress/onChangeText) ปลอดภัยกว่า findByProps */
function getFirstByTestId(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  const nodes = findAllByTestId(root, testID);
  if (nodes.length === 0) throw new Error(`ไม่พบ testID: ${testID}`);
  return nodes[0];
}

/** กรอกทุกช่องบังคับให้ผ่าน validation ยังไม่ติ๊กยอมรับข้อกำหนด */
const FREE_PHONE = '0891234567';

function fillValidForm(root: ReactTestRenderer.ReactTestInstance) {
  getFirstByTestId(root, 'input-username').props.onChangeText('somchai');
  getFirstByTestId(root, 'input-password').props.onChangeText('secret123');
  getFirstByTestId(root, 'input-phone').props.onChangeText(FREE_PHONE);
  getFirstByTestId(root, 'input-fullName').props.onChangeText('สมชาย ใจดี');
}

// Checkbox เป็นคอมโพเนนต์ของเราเอง node แรกที่ตรง testID จึงเป็น composite (props = checked/onChange)
function acceptTerms(root: ReactTestRenderer.ReactTestInstance) {
  const pressable = findAllByTestId(root, 'checkbox-terms').find(
    (n) => typeof n.props.onPress === 'function',
  );
  if (!pressable) throw new Error('ไม่พบปุ่มกดของ checkbox-terms');
  pressable.props.onPress();
}

function getErrorText(root: ReactTestRenderer.ReactTestInstance): string | undefined {
  const nodes = findAllByTestId(root, 'register-error');
  const withChildren = nodes.find((n) => typeof n.props.children === 'string');
  return withChildren?.props.children as string | undefined;
}

/** `google` ใส่เมื่อต้องการจำลองว่ามาจากปุ่ม Google (จอนั้นไม่มีช่องรหัสผ่าน) */
function renderRegister(
  navigation: { navigate: jest.Mock; goBack: jest.Mock },
  params: { google?: { googleToken: string; prefill: { email: string | null; fullName: string | null } } } = {},
) {
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <RegisterScreen
          navigation={
            navigation as unknown as NativeStackNavigationProp<AuthStackParamList, 'Register'>
          }
          route={{ key: 'k', name: 'Register', params: params.google ? params : undefined } as never}
        />
      </ThemeProvider>,
    );
  });
  return currentRenderer!;
}

describe('RegisterScreen', () => {
  it('กดสมัครโดยไม่กรอกอะไรเลย → ขึ้น error ครบข้อมูล', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBe(i18n.t('auth.register.required'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('กรอกครบทุกช่องแต่เบอร์โทร = "123" → ขึ้น error เบอร์โทรผิดรูปแบบ', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'input-username').props.onChangeText('somchai');
      getFirstByTestId(result.root, 'input-password').props.onChangeText('secret123');
      getFirstByTestId(result.root, 'input-phone').props.onChangeText('123');
      getFirstByTestId(result.root, 'input-fullName').props.onChangeText('สมชาย ใจดี');
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBe(i18n.t('auth.register.phoneInvalid'));
    expect(navigate).not.toHaveBeenCalled();
  });

  /** เกณฑ์เดียวกับ PASSWORD_MIN_LENGTH ฝั่งเซิร์ฟเวอร์ ถ้าจอนี้ปล่อยผ่าน */
  it('รหัสผ่านสั้นกว่า 8 ตัว → ขึ้น error ตั้งแต่จอนี้ ไม่ปล่อยไปให้เซิร์ฟเวอร์ตีกลับ', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'input-username').props.onChangeText('somchai');
      getFirstByTestId(result.root, 'input-password').props.onChangeText('1234');
      getFirstByTestId(result.root, 'input-phone').props.onChangeText('0812345678');
      getFirstByTestId(result.root, 'input-fullName').props.onChangeText('สมชาย ใจดี');
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBe(i18n.t('auth.register.passwordTooShort'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('กรอกเบอร์โทรถูกต้องแต่อีเมล = "abc" → ขึ้น error รูปแบบอีเมลผิด', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'input-username').props.onChangeText('somchai');
      getFirstByTestId(result.root, 'input-email').props.onChangeText('abc');
      getFirstByTestId(result.root, 'input-password').props.onChangeText('secret123');
      getFirstByTestId(result.root, 'input-phone').props.onChangeText('0812345678');
      getFirstByTestId(result.root, 'input-fullName').props.onChangeText('สมชาย ใจดี');
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBe(i18n.t('auth.register.emailInvalid'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('กรอกครบถูกต้องแต่ไม่ติ๊กยอมรับข้อกำหนด → ขึ้น error ไม่ไปต่อ', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      fillValidForm(result.root);
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBe(i18n.t('auth.register.termsRequired'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('กรอกครบถูกต้องทั้งหมด (ไม่กรอกอีเมล) → ขอ OTP แล้วไป OtpVerify พร้อม form param', async () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      fillValidForm(result.root);
      acceptTerms(result.root);
    });

    // handleSubmit ขอรหัส OTP ก่อนเปลี่ยนจอ เป็น async แล้ว ต้องรอให้จบก่อนตรวจ
    await act(async () => {
      await getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('OtpVerify', {
      form: {
        username: 'somchai',
        email: undefined,
        password: 'secret123',
        phone: FREE_PHONE,
        fullName: 'สมชาย ใจดี',
      },
    });
  });

  // design โชว์ชิป +66 หน้าช่องเบอร์ และ placeholder เป็น "81 234 5678" (ไม่มี 0 นำ)
  it('กรอกเบอร์ตามรูปแบบที่ design โชว์ ("89 123 4567") → เก็บเป็น 0891234567', async () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      fillValidForm(result.root);
      getFirstByTestId(result.root, 'input-phone').props.onChangeText('89 123 4567');
      acceptTerms(result.root);
    });

    // handleSubmit ขอรหัส OTP ก่อนเปลี่ยนจอ เป็น async แล้ว ต้องรอให้จบก่อนตรวจ
    await act(async () => {
      await getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith(
      'OtpVerify',
      expect.objectContaining({ form: expect.objectContaining({ phone: FREE_PHONE }) }),
    );
  });

  it('กดลิงก์ย้อนกลับหัวจอ → เรียก navigation.goBack()', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'btn-back').props.onPress();
    });

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('กดลิงก์กลับไปหน้าเข้าสู่ระบบ → เรียก navigation.goBack()', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      getFirstByTestId(result.root, 'link-login').props.onPress();
    });

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
