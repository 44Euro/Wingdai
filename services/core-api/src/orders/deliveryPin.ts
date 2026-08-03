import { randomInt } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

/** PIN ยืนยันส่ง ลูกค้าเห็นบนจอติดตาม บอกไรเดอร์ตอนรับของ (design R11) */
export const DELIVERY_PIN_LENGTH = 4;

export function generateDeliveryPin(): string {
  return String(randomInt(0, 10_000)).padStart(DELIVERY_PIN_LENGTH, '0');
}

/** เทียบแบบเป๊ะ ไม่ trim ไม่แปลงชนิด ความยืดหยุ่นตรงนี้คือช่องโหว่ */
export function assertPinMatches(expected: string, given: string): void {
  if (given !== expected) {
    throw new BadRequestException({ fields: { deliveryPin: 'รหัสยืนยันไม่ถูกต้อง' } });
  }
}
