import { describe, it, expect } from 'vitest';
import { assertDeliveryProof } from './deliveryProof';

const PIN = '0481';

describe('assertDeliveryProof — ส่งมือต่อมือ', () => {
  it('มีทั้งรหัสถูกและรูป = ผ่าน', () => {
    expect(() => assertDeliveryProof({
      leaveAtDoor: false, expectedPin: PIN,
      given: { deliveryPin: PIN, photoPath: 'rider-docs/x.jpg' },
    })).not.toThrow();
  });

  it('ไม่มีรูป = ไม่ผ่าน แม้รหัสจะถูก', () => {
    expect(() => assertDeliveryProof({
      leaveAtDoor: false, expectedPin: PIN, given: { deliveryPin: PIN },
    })).toThrow();
  });

  it('ไม่มีรหัส = ไม่ผ่าน แม้จะมีรูป', () => {
    // ไม่งั้นไรเดอร์ปิดงานได้โดยไม่ต้องเจอลูกค้าเลย ซึ่งเป็นสิ่งเดียวที่ PIN มีไว้กัน
    expect(() => assertDeliveryProof({
      leaveAtDoor: false, expectedPin: PIN, given: { photoPath: 'rider-docs/x.jpg' },
    })).toThrow();
  });

  it('รหัสผิด = ไม่ผ่าน', () => {
    expect(() => assertDeliveryProof({
      leaveAtDoor: false, expectedPin: PIN,
      given: { deliveryPin: '9999', photoPath: 'rider-docs/x.jpg' },
    })).toThrow();
  });
});

describe('assertDeliveryProof — วางไว้หน้าประตู', () => {
  it('มีรูปอย่างเดียวก็ผ่าน — ลูกค้าไม่อยู่ให้บอกรหัส', () => {
    expect(() => assertDeliveryProof({
      leaveAtDoor: true, expectedPin: PIN, given: { photoPath: 'rider-docs/x.jpg' },
    })).not.toThrow();
  });

  it('ไม่มีรูป = ไม่ผ่าน · รูปคือหลักฐานชิ้นเดียวที่เหลือ', () => {
    expect(() => assertDeliveryProof({
      leaveAtDoor: true, expectedPin: PIN, given: {},
    })).toThrow();
  });

  it('ส่งรหัสผิดมาด้วยก็ไม่ล้ม — แอปเวอร์ชันเก่ายังส่งรหัสมาเสมอ', () => {
    expect(() => assertDeliveryProof({
      leaveAtDoor: true, expectedPin: PIN,
      given: { deliveryPin: '0000', photoPath: 'rider-docs/x.jpg' },
    })).not.toThrow();
  });

  it('รูปที่เป็นช่องว่างล้วนไม่นับว่ามีรูป', () => {
    expect(() => assertDeliveryProof({
      leaveAtDoor: true, expectedPin: PIN, given: { photoPath: '   ' },
    })).toThrow();
  });
});
