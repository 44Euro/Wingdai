import { isAdmin, type AccountType } from '../auth/roles';

/** ใครอ่านเธรดตั๋วได้ (สเปคคลื่น 2 §5.6) */
export function canReadTicket(input: {
  viewerId: string;
  viewerType: AccountType;
  ownerId: string;
}): boolean {
  return input.viewerId === input.ownerId || isAdmin(input.viewerType);
}

/** ตั๋วที่ปิดแล้วตอบไม่ได้ ต้องเปิดใบใหม่ ไม่งั้นเรื่องที่ปิดไปแล้วจะโตต่อโดยไม่มีใครเห็นในคิว */
export function canReply(status: 'open' | 'closed'): boolean {
  return status === 'open';
}
