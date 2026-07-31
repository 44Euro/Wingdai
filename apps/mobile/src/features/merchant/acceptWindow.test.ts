import {
  ACCEPT_WINDOW_SECONDS,
  secondsLeftToAccept,
  acceptUrgency,
} from './acceptWindow';

const at = (isoOffsetSeconds: number, now: number) =>
  new Date(now - isoOffsetSeconds * 1000).toISOString();

describe('นับถอยหลังให้ร้านกดรับออร์เดอร์', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);

  it('ออร์เดอร์ที่เพิ่งเข้ามาได้เวลาเต็ม', () => {
    expect(secondsLeftToAccept(at(0, now), now)).toBe(ACCEPT_WINDOW_SECONDS);
  });

  it('ผ่านไปครึ่งทางเหลือครึ่งเดียว', () => {
    expect(secondsLeftToAccept(at(30, now), now)).toBe(30);
  });

  /** ติดลบแล้วโชว์ "-12 วินาที" คือบั๊กที่ผู้ใช้เห็น ไม่ใช่ข้อมูลที่มีประโยชน์ */
  it('เกินเวลาแล้วหยุดที่ศูนย์ ไม่ติดลบ', () => {
    expect(secondsLeftToAccept(at(300, now), now)).toBe(0);
  });

  /** นาฬิกาเครื่องร้านอาจเดินช้ากว่าเซิร์ฟเวอร์ ทำให้ createdAt ดูเหมือนอยู่ในอนาคต */
  it('เวลาสร้างที่ดูเหมือนอยู่ในอนาคตยังโชว์ไม่เกินหน้าต่าง', () => {
    expect(secondsLeftToAccept(at(-10, now), now)).toBe(ACCEPT_WINDOW_SECONDS);
  });

  it('15 วินาทีสุดท้ายถือว่าเร่ง', () => {
    expect(acceptUrgency(60)).toBe('calm');
    expect(acceptUrgency(16)).toBe('calm');
    expect(acceptUrgency(15)).toBe('urgent');
    expect(acceptUrgency(1)).toBe('urgent');
  });

  it('หมดเวลาแล้วเป็นสถานะ late ไม่ใช่ urgent', () => {
    expect(acceptUrgency(0)).toBe('late');
  });
});
