import * as SecureStore from 'expo-secure-store';
import { prefKey, type Prefs } from './prefKeys';

/** ใช้ที่เก็บเดียวกับ token เพราะเป็นที่เก็บถาวรที่เดียวที่แอปมีอยู่แล้ว */
export const prefs: Prefs = {
  async get(k) {
    return (await SecureStore.getItemAsync(prefKey(k))) === '1';
  },

  async mark(k) {
    await SecureStore.setItemAsync(prefKey(k), '1');
  },
};
