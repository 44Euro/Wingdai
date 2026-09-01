import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { OrderStatus } from './stateMachine';

/** ยอดทิปสูงสุดต่อออเดอร์ (สตางค์) ฿500 */
export const MAX_TIP_SATANG = 50_000;

/** ให้ทิปได้เมื่อไหร่ (design C11) ฟังก์ชันบริสุทธิ์ เทสต์ได้โดยไม่ต้องมีฐาน */
export function assertCanTip(input: {
  viewerId: string;
  order: { customerId: string; riderId: string | null; status: OrderStatus; tipSatang: number };
  amountSatang: number;
}): void {
  if (input.order.customerId !== input.viewerId) {
    throw new ForbiddenException({ message: 'ให้ทิปได้เฉพาะออเดอร์ของตัวเอง' });
  }

  if (input.order.status !== 'delivered') {
    throw new BadRequestException({ message: 'ให้ทิปได้หลังจากได้รับอาหารแล้ว' });
  }

  // ไม่มีไรเดอร์ = ไม่มีใครรับทิป เงินจะค้างอยู่ในบัญชีบริษัทโดยไม่มีเจ้าของ
  if (!input.order.riderId) {
    throw new BadRequestException({ message: 'ออเดอร์นี้ไม่มีไรเดอร์ให้ทิป' });
  }

  if (input.order.tipSatang > 0) {
    throw new BadRequestException({ message: 'ออเดอร์นี้ให้ทิปไปแล้ว' });
  }

  if (!Number.isInteger(input.amountSatang) || input.amountSatang <= 0) {
    throw new BadRequestException({
      message: 'ยอดทิปต้องเป็นจำนวนเต็มสตางค์ที่มากกว่าศูนย์',
      fields: { amountSatang: 'ยอดไม่ถูกต้อง' },
    });
  }

  if (input.amountSatang > MAX_TIP_SATANG) {
    throw new BadRequestException({
      message: `ทิปได้สูงสุด ${MAX_TIP_SATANG / 100} บาทต่อออเดอร์`,
      fields: { amountSatang: 'ยอดสูงเกินไป' },
    });
  }
}
