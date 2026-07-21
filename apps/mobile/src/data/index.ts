import type { Repos } from './repositories';
import { createMockRepos } from './mock';
import { createHttpRepos } from './http';

/** จุดเดียวในโปรเจกต์ที่ตัดสินว่าใช้ mock หรือ API จริง */
const USE_MOCK = true;
const API_BASE_URL = 'https://api.wingdai.invalid';

export const repos: Repos = USE_MOCK ? createMockRepos() : createHttpRepos(API_BASE_URL);

export type { Repos } from './repositories';
