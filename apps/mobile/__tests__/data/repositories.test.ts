import { createHttpRepos, NotImplementedError } from '../../src/data/http';
import { createMockRepos } from '../../src/data/mock';

describe('HttpRepo stub', () => {
  const repos = createHttpRepos('https://example.invalid');

  it('มี repo ครบทุกตัวตาม interface', () => {
    expect(repos.auth).toBeDefined();
    expect(repos.catalog).toBeDefined();
    expect(repos.orders).toBeDefined();
  });

  it('ทุก method โยน NotImplementedError ไม่ใช่เงียบ ๆ', async () => {
    await expect(repos.auth.login('a', 'b')).rejects.toThrow(NotImplementedError);
    await expect(repos.catalog.listRestaurants()).rejects.toThrow(NotImplementedError);
    await expect(repos.orders.get('o1')).rejects.toThrow(NotImplementedError);
  });
});

// design C2 เขียนว่า "ค้นหาร้านหรือเมนู" — คนพิมพ์ชื่ออาหารต้องเจอร้านที่ขายของนั้น
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
