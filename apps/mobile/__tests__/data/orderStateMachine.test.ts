import {
  isActiveStatus,
  canTransition,
  assertTransition,
  InvalidTransitionError,
} from '../../src/data/orderStateMachine';

describe('order state machine', () => {
  it('เส้นทางปกติผ่านทุกขั้น', () => {
    expect(canTransition('created', 'accepted')).toBe(true);
    expect(canTransition('accepted', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'picked_up')).toBe(true);
    expect(canTransition('picked_up', 'delivered')).toBe(true);
  });

  it('ยกเลิกได้ก่อนรับของ', () => {
    expect(canTransition('created', 'cancelled')).toBe(true);
    expect(canTransition('accepted', 'cancelled')).toBe(true);
    expect(canTransition('preparing', 'cancelled')).toBe(true);
  });

  it('ยกเลิกหลังรับของแล้วไม่ได้', () => {
    expect(canTransition('picked_up', 'cancelled')).toBe(false);
  });

  it('ห้ามข้ามขั้น', () => {
    expect(canTransition('created', 'delivered')).toBe(false);
    expect(canTransition('created', 'picked_up')).toBe(false);
    expect(canTransition('accepted', 'delivered')).toBe(false);
  });

  it('ห้ามถอยหลัง', () => {
    expect(canTransition('delivered', 'picked_up')).toBe(false);
    expect(canTransition('preparing', 'created')).toBe(false);
  });

  it('สถานะสุดท้ายไปไหนไม่ได้อีก', () => {
    expect(canTransition('delivered', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'accepted')).toBe(false);
  });

  it('assertTransition โยน error เมื่อไม่ถูกต้อง', () => {
    expect(() => assertTransition('created', 'delivered')).toThrow(InvalidTransitionError);
  });

  it('assertTransition เงียบเมื่อถูกต้อง', () => {
    expect(() => assertTransition('created', 'accepted')).not.toThrow();
  });
});

describe('isActiveStatus', () => {
  it('สถานะที่ยังเปลี่ยนต่อได้ = ออร์เดอร์ยังไม่จบ', () => {
    expect(isActiveStatus('created')).toBe(true);
    expect(isActiveStatus('accepted')).toBe(true);
    expect(isActiveStatus('preparing')).toBe(true);
    expect(isActiveStatus('picked_up')).toBe(true);
  });

  it('ปลายทางของ state machine = จบแล้ว', () => {
    expect(isActiveStatus('delivered')).toBe(false);
    expect(isActiveStatus('cancelled')).toBe(false);
  });
});
