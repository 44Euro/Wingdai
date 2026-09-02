import { describe, it, expect } from 'vitest';
import { sslMode } from './sslMode';

describe('เลือกโหมด TLS ตามปลายทาง', () => {
  it('Supabase ต้องบังคับ TLS เสมอ', () => {
    expect(sslMode('postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres')).toBe('require');
    expect(sslMode('postgres://u:p@db.abcdefg.supabase.co:5432/postgres')).toBe('require');
  });

  it('ฐานในเครื่องไม่มี TLS ให้ บังคับแล้วต่อไม่ติดเลย', () => {
    // service container ของ CI กับ docker ในเครื่องพูด TLS ไม่ได้ทั้งคู่
    expect(sslMode('postgres://postgres:postgres@localhost:5432/postgres')).toBe(false);
    expect(sslMode('postgres://postgres:postgres@127.0.0.1:5433/postgres')).toBe(false);
    expect(sslMode('postgres://postgres:postgres@[::1]:5432/postgres')).toBe(false);
  });

  it('โฮสต์ที่อ่านไม่ออกให้ถือว่าเป็นของนอก ปลอดภัยกว่าเดาว่าเป็นในเครื่อง', () => {
    expect(sslMode('ไม่ใช่ url ด้วยซ้ำ')).toBe('require');
    expect(sslMode('')).toBe('require');
  });
});
