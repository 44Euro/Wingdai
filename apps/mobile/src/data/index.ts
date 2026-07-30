import Constants from 'expo-constants';
import type { Repos } from './repositories';
import { createMockRepos } from './mock';
import { createHttpRepos } from './http';
import { session } from './http/session';

/**
 * จุดเดียวในโปรเจกต์ที่ตัดสินว่าใช้ mock หรือ API จริง (claude.md §9)
 *
 * ตั้งจาก `extra.apiBaseUrl` ใน app.config.ts ซึ่งอ่านต่อจาก env `WINGDAI_API_URL`
 * ไม่ใส่ = ใช้ mock ทั้งก้อน แอปจึงเปิดได้เสมอแม้ไม่มีเซิร์ฟเวอร์รันอยู่
 *
 * ตั้งใจให้ mock เป็นค่าเริ่มต้น เพราะการเปิดแอปมาแล้วเจอจอว่างเพราะลืมสั่ง `npm run dev`
 * ที่ core-api เป็นประสบการณ์ที่แย่และหาสาเหตุยากกว่าการเห็นข้อมูลตัวอย่าง
 */
const apiBaseUrl = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;

export const usingRealApi = !!apiBaseUrl;

export const repos: Repos = apiBaseUrl
  ? createHttpRepos(apiBaseUrl, session)
  : createMockRepos();

export type { Repos } from './repositories';
