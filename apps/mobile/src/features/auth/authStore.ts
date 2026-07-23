import { create } from 'zustand';
import { repos } from '../../data';
import { capabilitiesOf } from '../../lib/capabilities';
import type { Account, Capability, Restaurant } from '../../data/types';

type AuthState = {
  account: Account | null;
  restaurants: Restaurant[];
  capabilities: Capability[];
  activeCapability: Capability | null;
  isLoading: boolean;
  /** i18n key (เช่น 'auth.login.invalidCredentials') ไม่ใช่ข้อความดิบ — ฝั่ง UI ต้องแปลผ่าน t() ก่อนแสดง */
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveCapability: (cap: Capability) => void;
};

/** ลำดับความสำคัญของ stack เริ่มต้นเมื่อมีหลาย capability */
function defaultCapability(caps: Capability[]): Capability | null {
  const order: Capability[] = ['admin', 'rider', 'merchant', 'customer'];
  return order.find((c) => caps.includes(c)) ?? null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  account: null,
  restaurants: [],
  capabilities: [],
  activeCapability: null,
  isLoading: false,
  error: null,

  async login(username, password) {
    set({ isLoading: true, error: null });
    try {
      const account = await repos.auth.login(username, password);
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
    } catch {
      // ไม่เอาข้อความดิบจาก error object มาเก็บ — repos.auth.login ล้มเหลวได้สาเหตุเดียวคือ
      // ข้อมูลเข้าสู่ระบบผิด จึง map ตรงเป็น i18n key เดียวเสมอ ให้ฝั่ง UI แปลก่อนแสดง
      set({
        account: null, restaurants: [], capabilities: [], activeCapability: null,
        isLoading: false,
        error: 'auth.login.invalidCredentials',
      });
    }
  },

  async logout() {
    await repos.auth.logout();
    set({
      account: null, restaurants: [], capabilities: [],
      activeCapability: null, isLoading: false, error: null,
    });
  },

  setActiveCapability(cap) {
    // ห้ามสลับไป capability ที่บัญชีนี้ไม่มีสิทธิ์
    if (!get().capabilities.includes(cap)) return;
    set({ activeCapability: cap });
  },
}));
