import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from './tokenStore';

const KEY = 'wingdai.session.token';

/** เก็บ token ใน Keychain (iOS) / Keystore (Android) ไม่ใช่ AsyncStorage */
let cached: string | null = null;

export const session: TokenStore = {
  /** อ่านจากที่เก็บถาวรครั้งแรกตอนเปิดแอป */
  async load(): Promise<string | null> {
    cached = await SecureStore.getItemAsync(KEY);
    return cached;
  },

  get(): string | null {
    return cached;
  },

  async set(token: string): Promise<void> {
    cached = token;
    await SecureStore.setItemAsync(KEY, token);
  },

  async clear(): Promise<void> {
    cached = null;
    await SecureStore.deleteItemAsync(KEY);
  },
};
