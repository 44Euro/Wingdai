import { describe, it, expect } from 'vitest';
import { buildDocumentPath, assertAllowedExtension } from './storage.service';

/** เส้นทางไฟล์ใน Storage */
describe('เส้นทางไฟล์ใน Storage', () => {
  it('ขึ้นต้นด้วย accountId เสมอ เพื่อให้ policy กันข้ามบัญชีได้', () => {
    const p = buildDocumentPath('acc-123', 'id_card_front', 'jpg');
    expect(p.startsWith('acc-123/')).toBe(true);
  });

  it('ไม่ยอมให้ path เดินออกนอกโฟลเดอร์ตัวเอง', () => {
    expect(() => buildDocumentPath('../other', 'selfie', 'jpg')).toThrow();
    expect(() => buildDocumentPath('acc-123', '../../etc/passwd', 'jpg')).toThrow();
    expect(() => buildDocumentPath('acc/123', 'selfie', 'jpg')).toThrow();
  });

  it('ส่วนของเส้นทางที่ว่างเปล่าถูกปฏิเสธ', () => {
    expect(() => buildDocumentPath('', 'selfie', 'jpg')).toThrow();
    expect(() => buildDocumentPath('acc-123', '', 'jpg')).toThrow();
  });

  /** `svg` กับ `html` รันสคริปต์ได้เมื่อถูกเปิดตรงจาก URL สาธารณะ */
  it('รับเฉพาะนามสกุลรูปที่รู้จัก', () => {
    expect(() => assertAllowedExtension('jpg')).not.toThrow();
    expect(() => assertAllowedExtension('png')).not.toThrow();
    expect(() => assertAllowedExtension('svg')).toThrow();
    expect(() => assertAllowedExtension('html')).toThrow();
    expect(() => assertAllowedExtension('pdf')).toThrow();
  });

  it('นามสกุลตัวใหญ่ก็รับ และเก็บเป็นตัวเล็กเสมอ', () => {
    expect(() => assertAllowedExtension('JPG')).not.toThrow();
    expect(buildDocumentPath('acc-1', 'selfie', 'PNG').endsWith('.png')).toBe(true);
  });

  /** ไฟล์ของ kind เดิมต้องไม่ทับกัน ส่งใหม่แล้วของเก่าต้องยังอยู่ให้แอดมินเทียบได้ */
  it('ส่งซ้ำได้เส้นทางใหม่ ไม่ทับของเดิม', async () => {
    const a = buildDocumentPath('acc-1', 'selfie', 'jpg');
    await new Promise((r) => { setTimeout(r, 2); });
    const b = buildDocumentPath('acc-1', 'selfie', 'jpg');
    expect(a).not.toBe(b);
  });
});
