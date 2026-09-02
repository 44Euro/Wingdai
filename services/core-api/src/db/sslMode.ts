/**
 * Supabase ต้องต่อผ่าน TLS เสมอ แต่ฐานในเครื่องกับ service container ของ CI พูด TLS ไม่ได้
 * บังคับ 'require' ตายตัวจึงทำให้ต่อฐานในเครื่องไม่ติดเลย
 * ("Client network socket disconnected before secure TLS connection was established")
 * ซึ่งเป็นเหตุผลที่ท่อข้อมูลสาธิตทั้งเส้นไม่เคยถูกทดสอบนอกโปรดักชัน
 *
 * เดาไม่ออกเมื่อไรให้ถือว่าเป็นของนอก การเผลอเข้ารหัสไม่เสียหาย แต่เผลอไม่เข้ารหัสเสียหาย
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function sslMode(url: string): 'require' | false {
  try {
    const host = new URL(url).hostname;
    return LOCAL_HOSTS.has(host) ? false : 'require';
  } catch {
    return 'require';
  }
}
