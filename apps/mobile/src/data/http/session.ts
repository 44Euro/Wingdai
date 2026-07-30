import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from './tokenStore';

const KEY = 'wingdai.session.token';

/**
 * เก็บ token ใน Keychain (iOS) / Keystore (Android) ไม่ใช่ AsyncStorage
 *
 * token เซสชันอายุ 30 วันและใช้เข้าถึงบัญชีได้เต็มที่ ถ้าเก็บใน AsyncStorage
 * มันจะเป็นไฟล์ธรรมดาที่อ่านได้ทันทีบนเครื่องที่ root/jailbreak แล้ว
 *
 * เก็บไว้ในหน่วยความจำด้วยเพื่อไม่ต้องอ่าน Keychain ทุก request (ช้าและเป็น I/O)
 * ค่าในหน่วยความจำเป็นตัวจริงเสมอหลังเรียก load() ครั้งแรก
 */
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
