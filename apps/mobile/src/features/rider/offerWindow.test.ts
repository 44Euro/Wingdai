import { secondsLeftToRespond, RESPOND_WINDOW_SECONDS } from './offerWindow';

const now = Date.UTC(2026, 6, 31, 12, 0, 0);
const inSeconds = (s: number) => new Date(now + s * 1000).toISOString();

describe('นับถอยหลังตอบรับงานของไรเดอร์', () => {
  it('เพิ่งถูกเสนอ = ได้เวลาเต็ม', () => {
    expect(secondsLeftToRespond(inSeconds(15), now)).toBe(RESPOND_WINDOW_SECONDS);
  });

  it('เหลือ 7 วินาที', () => {
    expect(secondsLeftToRespond(inSeconds(7), now)).toBe(7);
  });

  it('หมดเวลาแล้วหยุดที่ศูนย์ ไม่ติดลบ', () => {
    expect(secondsLeftToRespond(inSeconds(-30), now)).toBe(0);
  });

  /**
   * นาฬิกาเครื่องไรเดอร์อาจช้ากว่าเซิร์ฟเวอร์ ทำให้ expiresAt ดูไกลเกินจริง
   * โชว์ 40 วินาทีทั้งที่หน้าต่างจริงคือ 15 = ไรเดอร์กดตอนเลยเวลาแล้วโดนปฏิเสธ
   */
  it('นาฬิกาเครื่องเพี้ยนก็ยังไม่โชว์เกินหน้าต่างจริง', () => {
    expect(secondsLeftToRespond(inSeconds(40), now)).toBe(RESPOND_WINDOW_SECONDS);
  });
});
