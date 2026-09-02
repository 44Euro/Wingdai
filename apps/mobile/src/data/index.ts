import type { Repos } from './repositories';
import { createMockRepos } from './mock';
import { localiseNames } from '../lib/localiseNames';
import { activeLanguage } from '../lib/activeLanguage';
import { createHttpRepos } from './http';
import { session } from './http/session';
import { probeApi } from './probe';

/** `live` = คุยกับ core-api จริง `demo` = ข้อมูลจำลองในเครื่อง */
export type DataMode = 'live' | 'demo';

/**
 * ที่อยู่ของ core-api ที่ deploy ไว้ ไม่ใช่ความลับ มันฝังอยู่ในบันเดิลที่ผู้ใช้โหลดไปอยู่แล้ว
 * เขียนค่าตั้งต้นไว้ตรงนี้เพราะถ้าพึ่งตัวแปรแวดล้อมอย่างเดียว build ที่ไม่มีตัวแปรจะได้แอปที่
 * ตกไปโหมดสาธิตถาวรโดยไม่มีอะไรเตือน ตั้ง EXPO_PUBLIC_WINGDAI_API_URL เพื่อชี้ไปเซิร์ฟเวอร์อื่น
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_WINGDAI_API_URL
  ?? 'https://wingdai-api.vercel.app/api';

/** ตั้งต้นที่ข้อมูลจำลองเสมอ แล้วค่อยเลื่อนขึ้นไปใช้ API จริงถ้ามันตอบ */
const state = { repos: localiseRepos(createMockRepos()), mode: 'demo' as DataMode };

/**
 * โหมดจำลองไม่ได้ผ่านตัวห่อ fetch จึงไม่ได้เลือกภาษาชื่อให้เหมือนตอนต่อ API จริง
 * ห่อทีเดียวที่นี่ ผลลัพธ์ของทุกเมธอดจึงถูกแปลงเหมือนกันโดยไม่ต้องแตะโค้ดในตัวจำลอง
 * เรียกฟังก์ชันด้วย `this` ตัวจริง เมธอดที่เรียกกันเองข้างในจึงไม่ถูกแปลงซ้ำ
 */
function localiseRepos<T extends object>(repos: T): T {
  return new Proxy(repos, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        // ห่อด้วย Proxy ไม่ใช่ฟังก์ชันใหม่ property ของตัวเดิมจึงยังเข้าถึงได้
        // (เทสต์ใช้ jest.spyOn แล้วเรียก .mockResolvedValue บนตัวที่อ่านกลับมา)
        return new Proxy(value as (...a: unknown[]) => unknown, {
          apply(fn, _thisArg, args) {
            const out = Reflect.apply(fn, target, args);
            return out instanceof Promise
              ? out.then((r) => localiseNames(r, activeLanguage()))
              : localiseNames(out, activeLanguage());
          },
        });
      }
      return value !== null && typeof value === 'object'
        ? localiseRepos(value as object)
        : value;
    },
  });
}

/** `repos` ต้องเป็นวัตถุก้อนเดิมตลอดอายุแอป เพราะสิบเจ็ดไฟล์ import มันไว้ตั้งแต่ตอนโหลดโมดูล */
export const repos = {} as Repos;
for (const key of Object.keys(state.repos) as (keyof Repos)[]) {
  Object.defineProperty(repos, key, { get: () => state.repos[key], enumerable: true });
}

export function getDataMode(): DataMode {
  return state.mode;
}

/** เซิร์ฟเวอร์ยังตอบอยู่ไหม โหมดข้อมูลจำลองไม่ได้คุยกับใคร จึงถือว่าต่อติดเสมอ */
export async function pingApi(): Promise<boolean> {
  if (state.mode === 'demo') return true;
  return probeApi(API_BASE_URL);
}

/** เรียกครั้งเดียวตอนบูต ก่อนวาดจอแรก */
export async function initDataSource(): Promise<DataMode> {
  if (await probeApi(API_BASE_URL)) {
    state.repos = createHttpRepos(API_BASE_URL, session);
    state.mode = 'live';
  }
  return state.mode;
}

export type { Repos } from './repositories';
