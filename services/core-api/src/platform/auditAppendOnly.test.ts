import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { AUDIT_ACTIONS } from './audit.service';

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [full] : [];
  });
}

/** `audit_log` เขียนอย่างเดียว (สเปค §5.3 หลักการเดียวกับ ledger ใน product-spec §6.2) */
describe('audit_log เขียนอย่างเดียว', () => {
  const files = sourceFiles(SRC);

  it('ไม่มีที่ไหนในโค้ด UPDATE หรือ DELETE ตาราง audit_log', () => {
    const offenders: string[] = [];

    for (const file of files) {
      /** สคริปต์ smoke ลบข้อมูลทดสอบของตัวเองได้ ยกเว้นแบบเดียวกับที่ ledger ยกเว้นให้ */
      if (file.endsWith('api.smoke.ts')) continue;

      const code = readFileSync(file, 'utf8');
      // จับทั้งรูป drizzle (`update(auditLog)`) และ SQL ดิบ (`update audit_log`)
      const patterns = [
        /\.update\(\s*auditLog\s*\)/,
        /\.delete\(\s*auditLog\s*\)/,
        /update\s+audit_log/i,
        /delete\s+from\s+audit_log/i,
      ];
      if (patterns.some((p) => p.test(code))) offenders.push(file.replace(SRC, 'src'));
    }

    expect(offenders).toEqual([]);
  });

  /** ทุกการกระทำที่แตะเงินหรือสิทธิ์ต้องมีชื่ออยู่ในรายการ ไม่งั้นเขียน audit ไม่ได้เลย */
  it('ครอบสิ่งที่ SA5 ระบุไว้: คืนเงิน จ่ายเงิน และเปลี่ยนสิทธิ์', () => {
    expect(AUDIT_ACTIONS).toContain('refund.approved');
    expect(AUDIT_ACTIONS).toContain('restaurant.settled');
    expect(AUDIT_ACTIONS).toContain('rider.payout_paid');
    expect(AUDIT_ACTIONS).toContain('role.changed');
    expect(AUDIT_ACTIONS).toContain('pricing.changed');
  });

  it('ชื่อการกระทำไม่ซ้ำกัน', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });
});
