import { createHttpRepos, NotImplementedError } from '../../src/data/http';

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
