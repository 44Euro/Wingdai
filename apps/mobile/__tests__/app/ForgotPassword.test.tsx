import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ForgotPasswordScreen } from '../../src/app/navigators/ForgotPasswordScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { repos } from '../../src/data';
import { createMockRepos, MOCK_OTP, MOCK_VERIFICATION_TOKEN, MOCK_RESET_TOKEN } from '../../src/data/mock';
import type { AuthStackParamList } from '../../src/app/navigators/AuthNavigator';

const PHONE = '0812345678';
const NEW_PASSWORD = 'wingdai-new-1234';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

let current: ReactTestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => { current?.unmount(); });
  current = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  const nodes = root.findAll((n) => n.props?.testID === testID);
  if (nodes.length === 0) throw new Error(`ไม่พบ testID: ${testID}`);
  return nodes[0]!;
}

function has(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  return root.findAll((n) => n.props?.testID === testID).length > 0;
}

/** ปุ่มกดได้จริงคือ node ที่มี onPress ไม่ใช่ตัว wrapper */
function press(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  const node = root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  )[0];
  if (!node) throw new Error(`ไม่พบปุ่มที่กดได้: ${testID}`);
  return node;
}

function render(goBack = jest.fn()) {
  act(() => {
    current = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <ForgotPasswordScreen
          navigation={
            { navigate: jest.fn(), goBack } as unknown as
              NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>
          }
        />
      </ThemeProvider>,
    );
  });
  return current!.root;
}

async function walkToPasswordStep(root: ReactTestRenderer.ReactTestInstance) {
  await act(async () => { find(root, 'input-phone').props.onChangeText(PHONE); });
  await act(async () => { press(root, 'btn-send-reset').props.onPress(); });
  await act(async () => { find(root, 'input-forgot-otp-code').props.onChangeText(MOCK_OTP); });
  await act(async () => { press(root, 'btn-verify-reset').props.onPress(); });
}

describe('ลืมรหัสผ่าน (product-spec §4.2)', () => {
  it('เดินครบสามขั้นแล้วล็อกอินด้วยรหัสใหม่ได้จริง', async () => {
    const root = render();
    await walkToPasswordStep(root);

    await act(async () => {
      find(root, 'input-new-password').props.onChangeText(NEW_PASSWORD);
      find(root, 'input-confirm-password').props.onChangeText(NEW_PASSWORD);
    });
    await act(async () => { press(root, 'btn-save-password').props.onPress(); });

    expect(has(root, 'forgot-done')).toBe(true);
    await expect(repos.auth.login('somchai', NEW_PASSWORD)).resolves.toMatchObject({
      username: 'somchai',
    });
  });

  /** จอเดิมขึ้นข้อความว่าส่งแล้วโดยไม่เรียกอะไรเลย §10 ห้ามส่ง UI ที่ไม่ทำอะไร */
  it('กดส่งรหัสแล้วเรียกเซิร์ฟเวอร์จริง ไม่ใช่แค่เปลี่ยนข้อความ', async () => {
    const spy = jest.spyOn(repos.auth, 'requestOtp');
    const root = render();

    await act(async () => { find(root, 'input-phone').props.onChangeText(PHONE); });
    await act(async () => { press(root, 'btn-send-reset').props.onPress(); });

    expect(spy).toHaveBeenCalledWith(PHONE, 'password_reset');
    spy.mockRestore();
  });

  it('เบอร์ผิดรูปแบบไม่ยิงคำขอ และบอกว่าผิดตรงไหน', async () => {
    const spy = jest.spyOn(repos.auth, 'requestOtp');
    const root = render();

    await act(async () => { find(root, 'input-phone').props.onChangeText('123'); });
    await act(async () => { press(root, 'btn-send-reset').props.onPress(); });

    expect(spy).not.toHaveBeenCalled();
    expect(has(root, 'forgot-error')).toBe(true);
    spy.mockRestore();
  });

  /** เคสจากชุดเทสต์เดิมของจอนี้ เบอร์ว่างต้องไม่ยิงคำขอ */
  it('เบอร์ว่างแล้วกดส่ง ไม่ยิงคำขอ และขึ้นข้อความผิดพลาด', async () => {
    const spy = jest.spyOn(repos.auth, 'requestOtp');
    const root = render();

    await act(async () => { press(root, 'btn-send-reset').props.onPress(); });

    expect(spy).not.toHaveBeenCalled();
    expect(has(root, 'forgot-error')).toBe(true);
    spy.mockRestore();
  });

  /** เคสจากชุดเทสต์เดิมของจอนี้ กองซ้อนคือ Login -> ForgotPassword ปุ่มกลับจึงถอยกลับ */
  it('กดลิงก์กลับ เรียก goBack ไม่ใช่ push จอใหม่ทับ', async () => {
    const goBack = jest.fn();
    const root = render(goBack);

    await act(async () => { press(root, 'link-back-login').props.onPress(); });

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('รหัสผ่านสองช่องไม่ตรงกันไม่ยิงคำขอ', async () => {
    const root = render();
    await walkToPasswordStep(root);
    const spy = jest.spyOn(repos.auth, 'resetPassword');

    await act(async () => {
      find(root, 'input-new-password').props.onChangeText(NEW_PASSWORD);
      find(root, 'input-confirm-password').props.onChangeText('คนละอัน1234');
    });
    await act(async () => { press(root, 'btn-save-password').props.onPress(); });

    expect(spy).not.toHaveBeenCalled();
    expect(has(root, 'forgot-done')).toBe(false);
    spy.mockRestore();
  });
});

describe('ตั๋วยืนยันเบอร์ผูกวัตถุประสงค์ (product-spec §4.2)', () => {
  it('ขอรหัสเพื่อรีเซ็ตแล้วได้ตั๋วคนละใบกับตอนสมัครสมาชิก', async () => {
    const mock = createMockRepos();

    await mock.auth.requestOtp('0899999999', 'phone_verify');
    expect(await mock.auth.verifyOtp('0899999999', MOCK_OTP)).toBe(MOCK_VERIFICATION_TOKEN);

    await mock.auth.requestOtp(PHONE, 'password_reset');
    expect(await mock.auth.verifyOtp(PHONE, MOCK_OTP)).toBe(MOCK_RESET_TOKEN);
  });

  it('ตั๋วสมัครสมาชิกเอาไปตั้งรหัสผ่านใหม่ไม่ได้', async () => {
    const mock = createMockRepos();
    await mock.auth.requestOtp('0899999999', 'phone_verify');
    const ticket = await mock.auth.verifyOtp('0899999999', MOCK_OTP);

    await expect(
      mock.auth.resetPassword({ phone: PHONE, verificationToken: ticket, newPassword: NEW_PASSWORD }),
    ).rejects.toThrow();
  });

  /** เบอร์ที่ไม่มีบัญชีต้องได้คำตอบเหมือนเบอร์ที่มี ไม่งั้นเป็นเครื่องไล่เดาว่าเบอร์ไหนสมัครไว้ */
  it('ขอรหัสรีเซ็ตของเบอร์ที่ไม่มีบัญชี ตอบเหมือนเบอร์ที่มี', async () => {
    const mock = createMockRepos();

    const unknown = await mock.auth.requestOtp('0611111111', 'password_reset');
    const known = await mock.auth.requestOtp(PHONE, 'password_reset');

    expect(Object.keys(unknown).sort()).toEqual(Object.keys(known).sort());
  });

  it('ตั้งรหัสผ่านให้เบอร์ที่ไม่มีบัญชีก็ไม่โยน error ให้เดาได้', async () => {
    const mock = createMockRepos();
    await mock.auth.requestOtp('0611111111', 'password_reset');
    const ticket = await mock.auth.verifyOtp('0611111111', MOCK_OTP);

    await expect(
      mock.auth.resetPassword({
        phone: '0611111111',
        verificationToken: ticket,
        newPassword: NEW_PASSWORD,
      }),
    ).resolves.toBeUndefined();
  });
});
