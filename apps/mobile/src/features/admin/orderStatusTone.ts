import type { OrderStatus } from '../../data/types';

/**
 * สีของแบดจ์สถานะ อ่านสถานะได้จากสีก่อนอ่านตัวอักษร
 * ใบที่ยังไม่มีใครรับกับใบที่ยกเลิกคือสองอย่างที่ต้องสะดุดตาแอดมิน จึงเป็นสีเตือน
 * ใบที่จบแล้วเป็นสีกลาง ไม่ต้องแย่งสายตาไปจากใบที่ยังวิ่งอยู่
 */
export type BadgeTone = 'brand' | 'teal' | 'neutral' | 'danger';

const TONE: Record<OrderStatus, BadgeTone> = {
  created: 'brand',
  accepted: 'teal',
  preparing: 'teal',
  picked_up: 'teal',
  delivered: 'neutral',
  cancelled: 'danger',
};

export function orderStatusTone(status: OrderStatus, late = false): BadgeTone {
  // เลยกำหนดแล้วสำคัญกว่าสถานะ ต้องเห็นก่อนใบอื่นเสมอ ยกเว้นใบที่จบไปแล้ว
  if (late && status !== 'delivered' && status !== 'cancelled') return 'danger';
  return TONE[status] ?? 'neutral';
}
