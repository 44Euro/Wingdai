import type { Repos } from './repositories';
import { createMockRepos } from './mock';
import { createHttpRepos } from './http';
import { session } from './http/session';
import { probeApi } from './probe';

/** `live` = คุยกับ core-api จริง `demo` = ข้อมูลจำลองในเครื่อง */
export type DataMode = 'live' | 'demo';

// จุดเดียวในโปรเจกต์ที่ตัดสินว่าใช้ข้อมูลจำลองหรือ API จริง (product-spec §9)
const apiBaseUrl = process.env.EXPO_PUBLIC_WINGDAI_API_URL;

/** ตั้งต้นที่ข้อมูลจำลองเสมอ แล้วค่อยเลื่อนขึ้นไปใช้ API จริงถ้ามันตอบ */
const state = { repos: createMockRepos(), mode: 'demo' as DataMode };

/** `repos` ต้องเป็นวัตถุก้อนเดิมตลอดอายุแอป เพราะสิบเจ็ดไฟล์ import มันไว้ตั้งแต่ตอนโหลดโมดูล */
export const repos = {} as Repos;
for (const key of Object.keys(state.repos) as (keyof Repos)[]) {
  Object.defineProperty(repos, key, { get: () => state.repos[key], enumerable: true });
}

export function getDataMode(): DataMode {
  return state.mode;
}

/** เรียกครั้งเดียวตอนบูต ก่อนวาดจอแรก */
export async function initDataSource(): Promise<DataMode> {
  if (!apiBaseUrl) return state.mode;

  if (await probeApi(apiBaseUrl)) {
    state.repos = createHttpRepos(apiBaseUrl, session);
    state.mode = 'live';
  }
  return state.mode;
}

export type { Repos } from './repositories';
