import { create } from 'zustand';
import { repos } from '../../data';
import { capabilitiesOf } from '../../lib/capabilities';
import type { Account, Capability, Restaurant } from '../../data/types';
import type { GoogleRegisterInput, GoogleSignInResult, RegisterInput } from '../../data/repositories';

type AuthState = {
  account: Account | null;
  restaurants: Restaurant[];
  capabilities: Capability[];
  activeCapability: Capability | null;
  isLoading: boolean;
  /** true จนกว่าจะรู้ว่ามีเซสชันค้างอยู่หรือไม่ — กันจอ login แวบขึ้นมาแล้วหายไปเอง */
  isRestoring: boolean;
  /** i18n key (เช่น 'auth.login.invalidCredentials') ไม่ใช่ข้อความดิบ — ฝั่ง UI ต้องแปลผ่าน t() ก่อนแสดง */
  error: string | null;
  /** identifier รับได้ทั้ง username หรือเบอร์โทร — อีเมลใช้ล็อกอินไม่ได้ (claude.md §4.2) */
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  registerWithGoogle: (input: GoogleRegisterInput) => Promise<void>;
  /** คืนผลให้จอตัดสินใจว่าจะเข้าแอปเลย หรือพาไปกรอกฟอร์มสั้น */
  signInWithGoogle: (idToken: string) => Promise<GoogleSignInResult>;
  /** เปิดแอปมาแล้วเช็คว่ายังล็อกอินอยู่ไหม */
  restore: () => Promise<void>;
  logout: () => Promise<void>;
  /** C21 — แก้ชื่อ/อีเมล แล้วอัปเดตบัญชีในสโตร์ทันที เพราะทุกจอที่โชว์ชื่ออ่านจากตรงนี้ */
  updateProfile: (input: { fullName: string; email: string | null }) => Promise<void>;
  setActiveCapability: (cap: Capability) => void;
};

/** ลำดับความสำคัญของ stack เริ่มต้นเมื่อมีหลาย capability */
function defaultCapability(caps: Capability[]): Capability | null {
  const order: Capability[] = ['admin', 'rider', 'merchant', 'customer'];
  return order.find((c) => caps.includes(c)) ?? null;
}

const signedOut = {
  account: null,
  restaurants: [] as Restaurant[],
  capabilities: [] as Capability[],
  activeCapability: null,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...signedOut,
  isLoading: false,
  isRestoring: true,
  error: null,

  async login(identifier, password) {
    set({ isLoading: true, error: null });
    try {
      await applyAccount(set, await repos.auth.login(identifier, password));
    } catch {
      // ไม่เอาข้อความดิบจาก error มาเก็บ — เหตุผลเดียวที่ล็อกอินล้มคือข้อมูลเข้าสู่ระบบผิด
      // จึง map ตรงเป็น i18n key เดียวเสมอ ให้ฝั่ง UI แปลก่อนแสดง
      set({ ...signedOut, isLoading: false, error: 'auth.login.invalidCredentials' });
    }
  },

  async register(input) {
    set({ isLoading: true, error: null });
    try {
      await applyAccount(set, await repos.auth.register(input));
    } catch {
      // เหตุผลที่พบบ่อยที่สุดคือ username ซ้ำ — ของจริงเซิร์ฟเวอร์บอกรายช่องมาด้วย
      set({ ...signedOut, isLoading: false, error: 'auth.register.usernameTaken' });
    }
  },

  async registerWithGoogle(input) {
    set({ isLoading: true, error: null });
    try {
      await applyAccount(set, await repos.auth.googleRegister(input));
    } catch {
      set({ ...signedOut, isLoading: false, error: 'auth.register.usernameTaken' });
    }
  },

  async signInWithGoogle(idToken) {
    set({ isLoading: true, error: null });
    try {
      const result = await repos.auth.googleSignIn(idToken);
      // ยังต้องกรอกฟอร์มสั้น = ยังไม่ถือว่าล็อกอินสำเร็จ ปล่อยให้จอพาไปต่อ
      if (result.needsRegistration) {
        set({ isLoading: false });
        return result;
      }
      await applyAccount(set, result.account);
      return result;
    } catch (error) {
      set({ ...signedOut, isLoading: false, error: 'auth.login.googleFailed' });
      throw error;
    }
  },

  async restore() {
    try {
      const account = await repos.auth.restore();
      if (!account) {
        set({ ...signedOut, isRestoring: false });
        return;
      }
      await applyAccount(set, account);
      set({ isRestoring: false });
    } catch {
      // เน็ตหลุดตอนเปิดแอป — ถือว่ายังไม่ล็อกอิน ผู้ใช้ล็อกอินใหม่ได้เมื่อเน็ตกลับมา
      set({ ...signedOut, isRestoring: false });
    }
  },

  async logout() {
    await repos.auth.logout();
    set({ ...signedOut, isLoading: false, error: null });
  },

  /*
   * ไม่แตะ capabilities/restaurants — แก้ชื่อกับอีเมลไม่ได้เปลี่ยนสิทธิ์อะไรเลย
   * โยน error ต่อให้จอจัดการ เพราะอีเมลซ้ำต้องขึ้นใต้ช่องอีเมล ไม่ใช่กลายเป็น error ของทั้งสโตร์
   */
  async updateProfile(input) {
    const account = await repos.auth.updateProfile(input);
    set({ account });
  },

  setActiveCapability(cap) {
    // ห้ามสลับไป capability ที่บัญชีนี้ไม่มีสิทธิ์
    if (!get().capabilities.includes(cap)) return;
    set({ activeCapability: cap });
  },
}));

/**
 * เก็บบัญชีที่ล็อกอินสำเร็จ พร้อมคำนวณ capability จากรายชื่อร้าน
 *
 * ต้องโหลดรายชื่อร้านด้วย เพราะสิทธิ์โหมดร้านมาจากการเทียบ ownerUserId กับ id ของบัญชี
 * (claude.md §4.3 — merchant เป็นความสามารถ ไม่ใช่ประเภทบัญชี)
 */
async function applyAccount(
  set: (partial: Partial<AuthState>) => void,
  account: Account,
): Promise<void> {
  const restaurants = await repos.catalog.listRestaurants();
  const capabilities = capabilitiesOf(account, restaurants);
  set({
    account,
    restaurants,
    capabilities,
    activeCapability: defaultCapability(capabilities),
    isLoading: false,
    error: null,
  });
}
