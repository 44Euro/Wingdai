import { useAuthStore } from '../../src/features/auth/authStore';
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
});
