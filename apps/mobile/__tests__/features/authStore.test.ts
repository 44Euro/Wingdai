import { useAuthStore } from '../../src/features/auth/authStore';
import { requestOtp, verifyOtp } from '../../src/features/auth/otp';
import { MOCK_VERIFICATION_TOKEN } from '../../src/data/mock';
import { initI18n, i18n } from '../../src/i18n';

beforeAll(async () => {
  await initI18n();
});

beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [],
    activeCapability: null, isLoading: false, error: null,
  });
});

describe('authStore', () => {
  it('ล็อกอินเป็น user ธรรมดาได้ capability customer และตั้งเป็น active', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const s = useAuthStore.getState();
    expect(s.account?.username).toBe('somchai');
    expect(s.capabilities).toEqual(['customer']);
    expect(s.activeCapability).toBe('customer');
    expect(s.error).toBeNull();
  });

  it('ล็อกอินเป็นเจ้าของร้านได้ทั้ง customer และ merchant', async () => {
    await useAuthStore.getState().login('malee', '1234');
    expect(useAuthStore.getState().capabilities.sort()).toEqual(['customer', 'merchant']);
  });

  it('ไรเดอร์ที่อนุมัติแล้วได้ rider เป็น active เริ่มต้น', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    const s = useAuthStore.getState();
    expect(s.capabilities.sort()).toEqual(['customer', 'rider']);
    expect(s.activeCapability).toBe('rider');
  });

  it('ไรเดอร์ที่รออนุมัติไม่มี capability เลย', async () => {
    await useAuthStore.getState().login('rider_new', '1234');
    const s = useAuthStore.getState();
    expect(s.capabilities).toEqual([]);
    expect(s.activeCapability).toBeNull();
  });

  it('รหัสผิดเก็บ error เป็น i18n key และไม่ล็อกอิน', async () => {
    await useAuthStore.getState().login('somchai', 'wrong');
    const s = useAuthStore.getState();
    expect(s.account).toBeNull();
    expect(s.error).toBe('auth.login.invalidCredentials');
  });

  it('error key ที่เก็บแปลได้จริงทั้งไทยและอังกฤษ (ไม่ใช่สตริงดิบ)', async () => {
    await useAuthStore.getState().login('somchai', 'wrong');
    const errorKey = useAuthStore.getState().error;
    expect(errorKey).toBeTruthy();

    await i18n.changeLanguage('th');
    const th = i18n.t(errorKey as string);
    expect(th).not.toBe(errorKey);

    await i18n.changeLanguage('en');
    const en = i18n.t(errorKey as string);
    expect(en).not.toBe(errorKey);
    expect(en).not.toBe(th);
  });

  it('สลับ capability ที่มีสิทธิ์ได้', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    useAuthStore.getState().setActiveCapability('customer');
    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('สลับไป capability ที่ไม่มีสิทธิ์ไม่ได้', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    useAuthStore.getState().setActiveCapability('admin');
    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('ออกจากระบบล้าง state', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.account).toBeNull();
    expect(s.capabilities).toEqual([]);
  });

  it('สมัครสมาชิก user ใหม่ → เข้าสู่ระบบทันทีด้วย capability customer', async () => {
    await useAuthStore.getState().register({
      username: 'freshuser',
      password: '1234',
      fullName: 'ผู้ใช้ใหม่',
      phone: '0899999999',
      accountType: 'user',
      verificationToken: MOCK_VERIFICATION_TOKEN,
    });
    const s = useAuthStore.getState();
    expect(s.account?.username).toBe('freshuser');
    expect(s.activeCapability).toBe('customer');
    expect(s.error).toBeNull();
  });

  it('สมัครสมาชิกไรเดอร์ใหม่ → riderApproval pending, ไม่มี capability', async () => {
    await useAuthStore.getState().register({
      username: 'freshrider',
      password: '1234',
      fullName: 'ไรเดอร์ใหม่',
      phone: '0888888888',
      accountType: 'rider',
      verificationToken: MOCK_VERIFICATION_TOKEN,
    });
    const s = useAuthStore.getState();
    expect(s.account?.username).toBe('freshrider');
    expect(s.account?.riderApproval).toBe('pending');
    expect(s.capabilities).toEqual([]);
    expect(s.activeCapability).toBeNull();
  });

  it('สมัครด้วย username ซ้ำ → error เป็น key usernameTaken และไม่ตั้ง account', async () => {
    await useAuthStore.getState().register({
      username: 'somchai',
      password: '1234',
      fullName: 'สมชายปลอม',
      phone: '0811111111',
      accountType: 'user',
      verificationToken: MOCK_VERIFICATION_TOKEN,
    });
    const s = useAuthStore.getState();
    expect(s.error).toBe('auth.register.usernameTaken');
    expect(s.account).toBeNull();
  });

  it('สมัครโดยไม่มีตั๋วยืนยันเบอร์ → ไม่สำเร็จ (Google ก็ไม่ทดแทน OTP)', async () => {
    await useAuthStore.getState().register({
      username: 'noverify',
      password: '1234',
      fullName: 'ไม่ยืนยันเบอร์',
      phone: '0877777777',
      accountType: 'user',
      verificationToken: 'ตั๋วปลอม',
    });
    expect(useAuthStore.getState().account).toBeNull();
  });
});

/**
 * การยืนยันเบอร์ไม่ใช่สถานะของแอป จึงอยู่นอก authStore
 * ตั๋วที่ได้ถูกส่งต่อผ่าน route param ไปจนถึงจอสมัคร
 */
describe('การยืนยันเบอร์', () => {
  it('รหัสถูกต้องได้ตั๋วกลับมา', async () => {
    await expect(verifyOtp('0899999999', '123456')).resolves.toBe(MOCK_VERIFICATION_TOKEN);
  });

  it('รหัสผิดโยน error ไม่ใช่คืนค่าเงียบ ๆ', async () => {
    await expect(verifyOtp('0899999999', '000000')).rejects.toThrow();
  });

  it('ขอรหัสให้เบอร์ที่สมัครแล้วถูกปฏิเสธ ไม่เสีย SMS ทิ้ง', async () => {
    await expect(requestOtp('0812345678')).rejects.toThrow();
  });
});
