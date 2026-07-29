import { PipeTransform, BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

/** ตรวจ body ด้วย zod ตัวเดียวกับที่ฝั่งแอปใช้ แทน class-validator */
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (parsed.success) return parsed.data;

    // ส่งกลับเป็นราย field เพื่อให้แอปเอาไปแปะใต้ช่องที่ผิดได้ตรงช่อง
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw new BadRequestException({ message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง', fields });
  }
}
