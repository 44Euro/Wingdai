import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RegisterScreen } from '../../src/app/navigators/RegisterScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import type { AuthStackParamList } from '../../src/app/navigators/AuthNavigator';

// @testing-library/react-native ถูกถอดออกจากโปรเจกต์ — ใช้ react-test-renderer ตรง ๆ
//
// เทสต์นี้ render RegisterScreen ตรง ๆ (ไม่ผ่าน AuthNavigator/NavigationContainer เต็มรูปแบบ)
// พร้อม mock navigation prop เป็น object ธรรมดา ({ navigate: jest.fn(), goBack: jest.fn() })
// เพราะสิ่งที่ต้องตรวจคือ validation logic ภายในคอมโพเนนต์เอง (error message ที่ขึ้นตอนกดปุ่ม
// สมัคร) ไม่ได้ต้องพึ่ง navigation context จริงของ native-stack — render navigator เต็มรูปแบบ
// ในเทสต์ระดับนี้ไม่จำเป็นและเพิ่มความเปราะบางโดยไม่จำเป็น (ดู __tests__/app/RootNavigator.test.tsx
// สำหรับกรณีที่ต้อง render ผ่าน AuthNavigator ของจริง)

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

/** เอา node แรกที่ตรง testID มาใช้เรียก props (onPress/onChangeText) — ปลอดภัยกว่า findByProps
 * ซึ่ง throw เมื่อเจอมากกว่าหนึ่ง match (composite กับ host มักมี testID ซ้ำกัน) */
function getFirstByTestId(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  const nodes = findAllByTestId(root, testID);
  if (nodes.length === 0) throw new Error(`ไม่พบ testID: ${testID}`);
  return nodes[0];
}

/** กรอกทุกช่องบังคับให้ผ่าน validation — ยังไม่ติ๊กยอมรับข้อกำหนด */
function fillValidForm(root: ReactTestRenderer.ReactTestInstance) {
  getFirstByTestId(root, 'input-username').props.onChangeText('somchai');
  getFirstByTestId(root, 'input-password').props.onChangeText('secret123');
  getFirstByTestId(root, 'input-phone').props.onChangeText('0812345678');
  getFirstByTestId(root, 'input-fullName').props.onChangeText('สมชาย ใจดี');
}

// Checkbox เป็นคอมโพเนนต์ของเราเอง node แรกที่ตรง testID จึงเป็น composite (props = checked/onChange)
// ตัวที่กดได้จริงคือ Pressable ข้างใน — หยิบ node ตัวแรกที่มี onPress
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

function renderRegister(navigation: { navigate: jest.Mock; goBack: jest.Mock }) {
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <RegisterScreen
          navigation={
            navigation as unknown as NativeStackNavigationProp<AuthStackParamList, 'Register'>
          }
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

  it('กรอกครบถูกต้องทั้งหมด (ไม่กรอกอีเมล) → ไป OtpVerify พร้อม form param', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      fillValidForm(result.root);
      acceptTerms(result.root);
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('OtpVerify', {
      form: {
        username: 'somchai',
        email: undefined,
        password: 'secret123',
        phone: '0812345678',
        fullName: 'สมชาย ใจดี',
      },
    });
  });

  // design โชว์ชิป +66 หน้าช่องเบอร์ และ placeholder เป็น "81 234 5678" (ไม่มี 0 นำ)
  // คนกรอกตามที่เห็นต้องผ่าน และต้องเก็บลงฟอร์มเป็นรูปแบบเดียวกับที่ repo ใช้ค้นบัญชี
  it('กรอกเบอร์ตามรูปแบบที่ design โชว์ ("81 234 5678") → เก็บเป็น 0812345678', () => {
    const navigate = jest.fn();
    const goBack = jest.fn();
    const result = renderRegister({ navigate, goBack });

    act(() => {
      fillValidForm(result.root);
      getFirstByTestId(result.root, 'input-phone').props.onChangeText('81 234 5678');
      acceptTerms(result.root);
    });

    act(() => {
      getFirstByTestId(result.root, 'btn-register').props.onPress();
    });

    expect(getErrorText(result.root)).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith(
      'OtpVerify',
      expect.objectContaining({ form: expect.objectContaining({ phone: '0812345678' }) }),
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
