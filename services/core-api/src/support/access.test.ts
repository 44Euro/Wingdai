import { describe, it, expect } from 'vitest';
import { canReadTicket, canReply } from './access';
import { OpenTicketSchema, ReplySchema } from './dto';

const OWNER = 'acc-owner';
const OTHER = 'acc-other';

describe('canReadTicket', () => {
  it('เจ้าของตั๋วอ่านได้', () => {
    expect(canReadTicket({ viewerId: OWNER, viewerType: 'user', ownerId: OWNER })).toBe(true);
  });

  it('คนอื่นอ่านไม่ได้ แม้จะเป็นไรเดอร์ที่ส่งใบนั้นเอง', () => {
    // ตั๋วมักมีเรื่องที่ลูกค้าบ่นถึงไรเดอร์หรือร้านอยู่ในนั้นพอดี
    expect(canReadTicket({ viewerId: OTHER, viewerType: 'user', ownerId: OWNER })).toBe(false);
    expect(canReadTicket({ viewerId: OTHER, viewerType: 'rider', ownerId: OWNER })).toBe(false);
  });

  it('แอดมินและซูเปอร์แอดมินอ่านได้ทุกใบ', () => {
    expect(canReadTicket({ viewerId: OTHER, viewerType: 'admin', ownerId: OWNER })).toBe(true);
    expect(canReadTicket({ viewerId: OTHER, viewerType: 'super_admin', ownerId: OWNER })).toBe(true);
  });
});

describe('canReply', () => {
  it('ตั๋วที่เปิดอยู่ตอบได้ · ปิดแล้วตอบไม่ได้', () => {
    expect(canReply('open')).toBe(true);
    expect(canReply('closed')).toBe(false);
  });
});

describe('OpenTicketSchema', () => {
  const valid = { kind: 'order_problem' as const, subject: 'อาหารผิด', body: 'ได้ไม่ตรงที่สั่ง' };

  it('ผูกออร์เดอร์หรือไม่ผูกก็ได้', () => {
    expect(OpenTicketSchema.safeParse(valid).success).toBe(true);
    expect(OpenTicketSchema.safeParse({
      ...valid, orderId: '11111111-1111-4111-8111-111111111111',
    }).success).toBe(true);
  });

  it('หัวข้อหรือเนื้อความว่างเปิดไม่ได้ — ตั๋วเปล่าคือคิวที่แอดมินต้องไล่ถามใหม่ทุกใบ', () => {
    expect(OpenTicketSchema.safeParse({ ...valid, subject: '   ' }).success).toBe(false);
    expect(OpenTicketSchema.safeParse({ ...valid, body: '' }).success).toBe(false);
  });

  it('ชนิดนอกรายการเปิดไม่ได้ — ชนิดคือสิ่งที่แอดมินใช้กรองคิว', () => {
    expect(OpenTicketSchema.safeParse({ ...valid, kind: 'refund' }).success).toBe(false);
  });

  it('ตัดช่องว่างหัวท้ายก่อนเก็บ', () => {
    const parsed = OpenTicketSchema.parse({ ...valid, subject: '  อาหารผิด  ' });
    expect(parsed.subject).toBe('อาหารผิด');
  });
});

describe('ReplySchema', () => {
  it('ข้อความว่างส่งไม่ได้', () => {
    expect(ReplySchema.safeParse({ body: '  ' }).success).toBe(false);
    expect(ReplySchema.safeParse({ body: 'รับทราบครับ' }).success).toBe(true);
  });
});
