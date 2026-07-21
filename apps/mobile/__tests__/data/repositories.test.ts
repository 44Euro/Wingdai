import { createHttpRepos, ApiError } from '../../src/data/http';
import { createMemoryTokenStore } from '../../src/data/http/tokenStore';
import { createMockRepos } from '../../src/data/mock';

/** รีโปสองตัวต้องมีหน้าตาเหมือนกันเป๊ะ เพราะจอสลับใช้ตัวไหนก็ได้โดยไม่รู้ตัว (product-spec §9) */
describe('HttpRepo กับ MockRepo มีหน้าตาเหมือนกัน', () => {
  const http = createHttpRepos('https://example.invalid/api', createMemoryTokenStore());
  const mock = createMockRepos();

  const GROUPS = [
    'addresses', 'admin', 'auth', 'catalog', 'chat', 'config', 'favorites', 'merchant', 'orders',
    'refunds', 'reviews',
    'rider', 'super', 'support',
  ] as const;

  it('มีกลุ่ม repo ครบทุกกลุ่ม', () => {
    expect(Object.keys(http).sort()).toEqual([...GROUPS]);
    expect(Object.keys(mock).sort()).toEqual([...GROUPS]);
  });

  it('ทุกกลุ่มมี method ชื่อเดียวกันทั้งสองฝั่ง', () => {
    for (const group of GROUPS) {
      const httpMethods = Object.keys(http[group]).sort();
      const mockMethods = Object.keys(mock[group]).sort();
      expect({ group, httpMethods }).toEqual({ group, httpMethods: mockMethods });
    }
  });
});

describe('ApiError', () => {
  it('พาข้อความรายช่องมาให้จอแปะใต้ช่องที่ผิดได้', () => {
    const e = new ApiError(400, 'ข้อมูลไม่ถูกต้อง', { phone: 'เบอร์ผิดรูปแบบ' });
    expect(e.status).toBe(400);
    expect(e.fields?.phone).toBe('เบอร์ผิดรูปแบบ');
  });

  it('เน็ตหลุดใช้ status 0 เพื่อแยกจาก error ที่เซิร์ฟเวอร์ตอบกลับมา', () => {
    expect(ApiError.offline().status).toBe(0);
  });
});

// design C2 เขียนว่า "ค้นหาร้านหรือเมนู" คนพิมพ์ชื่ออาหารต้องเจอร้านที่ขายของนั้น
describe('catalog.searchRestaurants', () => {
  const repos = createMockRepos();

  it('ค้นด้วยชื่อร้านเจอร้านนั้น', async () => {
    const found = await repos.catalog.searchRestaurants('มาลี');
    expect(found.map((r) => r.id)).toContain('r-malee');
  });

  it('ค้นด้วยชื่อเมนูเจอร้านที่ขายเมนูนั้น', async () => {
    const found = await repos.catalog.searchRestaurants('กะเพรา');
    expect(found.map((r) => r.id)).toContain('r-malee');
  });

  it('คำค้นว่างคืนลิสต์ว่าง ไม่ใช่ทุกร้าน', async () => {
    expect(await repos.catalog.searchRestaurants('   ')).toEqual([]);
  });

  it('คำค้นที่ไม่ตรงอะไรเลยคืนลิสต์ว่าง', async () => {
    expect(await repos.catalog.searchRestaurants('zzzzไม่มีจริง')).toEqual([]);
  });
});
