/** ถาม core-api ว่ายังตอบอยู่ไหม ก่อนตัดสินใจว่าจะใช้ API จริงหรือข้อมูลจำลอง */
export async function probeApi(
  baseUrl: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<boolean> {
  const { fetchImpl = fetch, timeoutMs = 4000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${baseUrl}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
