import { probeApi } from '../../src/data/probe';

/** fetch ปลอมที่ตอบตามที่สั่ง ไม่แตะเครือข่ายจริง เทสต์จึงรันได้ใน CI ที่ไม่มีเซิร์ฟเวอร์ */
function fakeFetch(res: Partial<Response> | Error) {
  return jest.fn(async () => {
    if (res instanceof Error) throw res;
    return res as Response;
  }) as unknown as typeof fetch;
}

describe('probeApi', () => {
  it('ตอบ true เมื่อเซิร์ฟเวอร์ตอบ 200', async () => {
    await expect(probeApi('http://x/api', { fetchImpl: fakeFetch({ ok: true }) })).resolves.toBe(true);
  });

  it('ยิงไปที่ /health ต่อท้าย base url', async () => {
    const f = fakeFetch({ ok: true });
    await probeApi('http://x/api', { fetchImpl: f });
    expect(f).toHaveBeenCalledWith('http://x/api/health', expect.anything());
  });

  it('ตอบ false เมื่อเซิร์ฟเวอร์ตอบ 500 — ขึ้นอยู่แต่พัง ก็เท่ากับใช้ไม่ได้', async () => {
    await expect(probeApi('http://x/api', { fetchImpl: fakeFetch({ ok: false }) })).resolves.toBe(false);
  });

  it('ตอบ false เมื่อต่อไม่ติด แทนที่จะโยน error ออกไป', async () => {
    const f = fakeFetch(new Error('Network request failed'));
    await expect(probeApi('http://x/api', { fetchImpl: f })).resolves.toBe(false);
  });

  it('ตอบ false เมื่อเกินเพดานเวลา — เซิร์ฟเวอร์ที่ตอบช้าแย่กว่าเซิร์ฟเวอร์ที่ตายสนิท', async () => {
    // ค้างจนกว่าจะถูก abort เลียนแบบเซิร์ฟเวอร์ที่รับคอนเนกชันแล้วเงียบ
    const hanging = jest.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;

    await expect(probeApi('http://x/api', { fetchImpl: hanging, timeoutMs: 10 })).resolves.toBe(false);
  });
});
