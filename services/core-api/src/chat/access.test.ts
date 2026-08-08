import { describe, it, expect } from 'vitest';
import { canReadChannel, canSend, channelExists, type OrderParties } from './access';

const parties: OrderParties = {
  customerId: 'customer',
  riderId: 'rider',
  restaurantOwnerId: 'owner',
  status: 'picked_up',
};

const canRead = (viewerId: string, channel: 'customer_rider' | 'customer_merchant') =>
  canReadChannel({ viewerId, channel, parties });

describe('ใครอ่านช่องไหนได้ (design C10 · M10)', () => {
  it('ช่องลูกค้า–ไรเดอร์ อ่านได้แค่สองคนนั้น', () => {
    expect(canRead('customer', 'customer_rider')).toBe(true);
    expect(canRead('rider', 'customer_rider')).toBe(true);
  });

  /** ลูกค้าบอกไรเดอร์ว่า "รหัสประตู 1234 อยู่ห้อง 502" ร้านไม่มีเหตุผลต้องรู้ */
  it('ร้านอ่านช่องที่ลูกค้าคุยกับไรเดอร์ไม่ได้', () => {
    expect(canRead('owner', 'customer_rider')).toBe(false);
  });

  it('ไรเดอร์อ่านช่องที่ลูกค้าคุยกับร้านไม่ได้', () => {
    expect(canRead('rider', 'customer_merchant')).toBe(false);
  });

  it('ช่องลูกค้า–ร้าน อ่านได้แค่สองคนนั้น', () => {
    expect(canRead('customer', 'customer_merchant')).toBe(true);
    expect(canRead('owner', 'customer_merchant')).toBe(true);
  });

  /** แชทเป็นบทสนทนาส่วนตัว ไม่ใช่หลักฐานที่เก็บไว้ให้ทีมงานตรวจ เรื่องแบบนั้นไปทางตั๋ว (AD4) */
  it('คนนอกอ่านไม่ได้เลยสักช่อง', () => {
    for (const channel of ['customer_rider', 'customer_merchant'] as const) {
      expect(canRead('someone-else', channel)).toBe(false);
      expect(canRead('admin', channel)).toBe(false);
    }
  });

  it('ยังไม่มีไรเดอร์ ก็ยังไม่มีใครอ่านช่องนั้นได้นอกจากลูกค้า', () => {
    const noRider = { ...parties, riderId: null };
    expect(canReadChannel({ viewerId: 'rider', channel: 'customer_rider', parties: noRider }))
      .toBe(false);
  });
});

describe('ช่องมีอยู่ตอนไหน', () => {
  it('ช่องคุยกับร้านมีตั้งแต่สั่ง', () => {
    expect(channelExists('customer_merchant', { ...parties, riderId: null })).toBe(true);
  });

  /** จอที่เปิดได้แต่ไม่มีใครอยู่ปลายสาย แย่กว่าจอที่ยังไม่โผล่ */
  it('ช่องคุยกับไรเดอร์ยังไม่มี จนกว่าจะมีไรเดอร์', () => {
    expect(channelExists('customer_rider', { ...parties, riderId: null })).toBe(false);
    expect(channelExists('customer_rider', parties)).toBe(true);
  });
});

describe('ส่งข้อความได้ตอนไหน', () => {
  it('ระหว่างที่ออร์เดอร์ยังเดินอยู่ ส่งได้', () => {
    for (const s of ['created', 'accepted', 'preparing', 'picked_up'] as const) {
      expect(canSend(s)).toBe(true);
    }
  });

  /** จบงานแล้วเป็นอ่านอย่างเดียว ประวัติยังเปิดดูได้ว่าตกลงอะไรกันไว้ */
  it('ส่งถึงแล้วหรือยกเลิกแล้ว ส่งไม่ได้', () => {
    expect(canSend('delivered')).toBe(false);
    expect(canSend('cancelled')).toBe(false);
  });
});
