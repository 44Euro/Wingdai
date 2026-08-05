import { BadRequestException } from '@nestjs/common';
import { assertPinMatches } from './deliveryPin';

/** หลักฐานที่ต้องมีตอนไรเดอร์ปิดงาน (design R11 สเปคคลื่น 2 §7) */
export function assertDeliveryProof(input: {
  leaveAtDoor: boolean;
  expectedPin: string;
  given: { deliveryPin?: string; photoPath?: string };
}): void {
  const photo = input.given.photoPath?.trim();
  if (!photo) {
    throw new BadRequestException({ fields: { photoPath: 'ต้องแนบรูปตอนส่งถึง' } });
  }

  /** วางหน้าประตู: รหัสที่ส่งมาด้วย ไม่ต้องสนใจและต้องไม่ทำให้ล้ม แอปเวอร์ชันเก่า */
  if (input.leaveAtDoor) return;

  assertPinMatches(input.expectedPin, input.given.deliveryPin ?? '');
}
