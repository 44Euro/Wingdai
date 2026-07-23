import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { OtpVerifyScreen } from '../../src/app/navigators/OtpVerifyScreen';
import { ChooseAccountTypeScreen } from '../../src/app/navigators/ChooseAccountTypeScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { MOCK_VERIFICATION_TOKEN } from '../../src/data/mock';
import type { AuthStackParamList } from '../../src/app/navigators/AuthNavigator';
import type { RegisterFormValues } from '../../src/app/navigators/RegisterScreen';

// @testing-library/react-native ถูกถอดออกจากโปรเจกต์ ใช้ react-test-renderer ตรง ๆ

// username ต้องไม่ชนกับ seed accounts (somchai, malee, rider_ann, rider_new, admin_root)
const sampleForm: RegisterFormValues = {
  username: 'newuser_otp',
  email: undefined,
  password: 'secret123',
  phone: '0891234567',
  fullName: 'สมชาย ใจดี',
};

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

beforeEach(() => {
  useAuthStore.setState({
    account: null,
    restaurants: [],
    capabilities: [],
    activeCapability: null,
    isLoading: false,
    error: null,
  });
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

function getFirstByTestId(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  const nodes = findAllByTestId(root, testID);
  if (nodes.length === 0) throw new Error(`ไม่พบ testID: ${testID}`);
  return nodes[0];
}

function renderOtpVerify(navigation: { navigate: jest.Mock }) {
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <OtpVerifyScreen
          navigation={
            navigation as unknown as NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>
          }
          route={
            { key: 'OtpVerify', name: 'OtpVerify', params: { form: sampleForm } } as unknown as RouteProp<
              AuthStackParamList,
              'OtpVerify'
            >
          }
        />
      </ThemeProvider>,
    );
  });
  return currentRenderer!;
}

function renderChooseAccountType(form: RegisterFormValues = sampleForm) {
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <ChooseAccountTypeScreen
          route={
            {
              key: 'ChooseAccountType',
              name: 'ChooseAccountType',
              params: { form, verificationToken: MOCK_VERIFICATION_TOKEN },
            } as unknown as RouteProp<AuthStackParamList, 'ChooseAccountType'>
          }
        />
      </ThemeProvider>,
    );
  });
  return currentRenderer!;
}

describe('OtpVerifyScreen', () => {
  // ช่องกรอก OTP เป็น TextInput ใสวางทับกล่องหกช่อง ถ้าไม่มีตัวสั่ง focus
  it('แถวกล่องรหัสกดได้ และช่องกรอกโฟกัสเองตั้งแต่เปิดจอ', () => {
    const result = renderOtpVerify({ navigate: jest.fn() });
    expect(typeof getFirstByTestId(result.root, 'otp-boxes').props.onPress).toBe('function');
    expect(getFirstByTestId(result.root, 'input-otp-code').props.autoFocus).toBe(true);
  });

  it('พิมพ์ตัวอักษรที่ไม่ใช่ตัวเลข → ถูกตัดทิ้ง', () => {
    const result = renderOtpVerify({ navigate: jest.fn() });
    act(() => {
      getFirstByTestId(result.root, 'input-otp-code').props.onChangeText('1a2b3c4d');
    });
    expect(getFirstByTestId(result.root, 'input-otp-code').props.value).toBe('1234');
  });

  it('กรอกรหัสผิด (000000) → ขึ้น otp-error, ไม่ navigate', async () => {
    const navigate = jest.fn();
    const result = renderOtpVerify({ navigate });

    act(() => {
      getFirstByTestId(result.root, 'input-otp-code').props.onChangeText('000000');
    });

    await act(async () => {
      await getFirstByTestId(result.root, 'btn-verify-otp').props.onPress();
    });

    expect(findAllByTestId(result.root, 'otp-error').length).toBeGreaterThanOrEqual(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('กรอกรหัสถูก (123456) → navigate ไป ChooseAccountType พร้อม form', async () => {
    const navigate = jest.fn();
    const result = renderOtpVerify({ navigate });

    act(() => {
      getFirstByTestId(result.root, 'input-otp-code').props.onChangeText('123456');
    });

    await act(async () => {
      await getFirstByTestId(result.root, 'btn-verify-otp').props.onPress();
    });

    // ตั๋วต้องถูกส่งต่อไปด้วย ไม่ใช่แค่ form ไม่งั้นจอสมัครยื่นอะไรให้เซิร์ฟเวอร์ไม่ได้
    expect(navigate).toHaveBeenCalledWith('ChooseAccountType', {
      form: sampleForm,
      verificationToken: MOCK_VERIFICATION_TOKEN,
      google: undefined,
    });
    expect(findAllByTestId(result.root, 'otp-error').length).toBe(0);
  });
});

describe('ChooseAccountTypeScreen', () => {
  it('เลือก user → register สำเร็จเป็น customer', async () => {
    const result = renderChooseAccountType({ ...sampleForm, username: 'newuser_choose_user' });

    await act(async () => {
      getFirstByTestId(result.root, 'choose-user').props.onPress();
    });
    await act(async () => {
      await getFirstByTestId(result.root, 'btn-choose-continue').props.onPress();
    });

    const s = useAuthStore.getState();
    expect(s.account).not.toBeNull();
    expect(s.account?.accountType).toBe('user');
    expect(s.activeCapability).toBe('customer');
  });

  it('เลือก rider → register สำเร็จเป็นไรเดอร์รออนุมัติ ไม่มี capability', async () => {
    const result = renderChooseAccountType({ ...sampleForm, username: 'newuser_choose_rider' });

    await act(async () => {
      getFirstByTestId(result.root, 'choose-rider').props.onPress();
    });
    await act(async () => {
      await getFirstByTestId(result.root, 'btn-choose-continue').props.onPress();
    });

    const s = useAuthStore.getState();
    expect(s.account).not.toBeNull();
    expect(s.account?.accountType).toBe('rider');
    expect(s.account?.riderApproval).toBe('pending');
    expect(s.capabilities).toEqual([]);
  });

  it('ยืนยันไม่มี admin card ในหน้านี้', () => {
    const result = renderChooseAccountType();

    expect(
      result.root.findAll((n) => n.props?.testID === 'choose-admin').length,
    ).toBe(0);
  });
});
