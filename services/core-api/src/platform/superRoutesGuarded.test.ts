import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SuperController } from './super.controller';
import { AdminController } from '../refunds/refunds.controller';
import { SuperAdminGuard, AdminGuard } from '../auth/admin.guard';
import { JwtGuard } from '../auth/jwt.guard';

/**
 * แอดมินธรรมดาต้องแตะค่าคอม feature flag และสิทธิ์คนอื่นไม่ได้เลย
 *
 * `roles.test.ts` พิสูจน์แค่ว่า isSuperAdmin ตัดสินถูก แต่ไม่ได้พิสูจน์ว่ามีใครเรียกใช้มันจริง
 * ถ้าวันหนึ่งมีคนลบ SuperAdminGuard ออกจาก controller เทสต์ชุดเดิมยังเขียวหมด
 * ทั้งที่แอดมินเดินเข้าไปแก้ราคาได้แล้ว
 */
function guardsOf(target: unknown): unknown[] {
  return Reflect.getMetadata('__guards__', target as object) ?? [];
}

describe('เส้นทาง /super ต้องมีด่านซูเปอร์แอดมินคุมอยู่จริง', () => {
  it('SuperController ใช้ทั้ง JwtGuard และ SuperAdminGuard', () => {
    const guards = guardsOf(SuperController);
    expect(guards).toContain(JwtGuard);
    expect(guards).toContain(SuperAdminGuard);
  });

  it('SuperController ต้องไม่ใช้ AdminGuard ซึ่งปล่อยแอดมินธรรมดาผ่าน', () => {
    expect(guardsOf(SuperController)).not.toContain(AdminGuard);
  });

  /** เส้นทางแอดมินยังต้องเปิดให้แอดมินธรรมดาเข้าได้ตามเดิม ไม่ใช่ล็อกจนทำงานไม่ได้ */
  it('AdminController ใช้ AdminGuard ไม่ใช่ SuperAdminGuard', () => {
    const guards = guardsOf(AdminController);
    expect(guards).toContain(AdminGuard);
    expect(guards).not.toContain(SuperAdminGuard);
  });

  /** ตัวคุมอยู่ที่ระดับ controller ทุกเส้นทางที่เพิ่มทีหลังจึงถูกคุมโดยอัตโนมัติ */
  it('ไม่มีเส้นทางไหนใน super.controller ปลด guard ทิ้งเป็นรายเมธอด', () => {
    const source = readFileSync(join(__dirname, 'super.controller.ts'), 'utf8');
    const afterClass = source.slice(source.indexOf('export class SuperController'));
    expect(afterClass).not.toMatch(/@UseGuards|@SetMetadata|@Public/);
  });
});
