import { describe, it, expect } from 'vitest';
import { waitedFor } from './waitedFor';

/**
 * จอแอดมินเคยขึ้นว่า "ร้านยังไม่กดรับมา 219 นาที" ซึ่งต้องเอานิ้วนับเองว่ากี่ชั่วโมง
 * ใบที่ค้างข้ามคืนบนฐานสาธิตทำให้เลขไปถึงหลักพันได้ง่าย ๆ
 */
describe('บอกระยะเวลาที่รอ', () => {
  it('ต่ำกว่าชั่วโมงยังใช้หน่วยนาทีตามเดิม', () => {
    expect(waitedFor(1)).toBe('1 นาที');
    expect(waitedFor(45)).toBe('45 นาที');
    expect(waitedFor(59)).toBe('59 นาที');
  });

  it('ครบชั่วโมงพอดีไม่ต้องมีเศษนาทีห้อยท้าย', () => {
    expect(waitedFor(60)).toBe('1 ชม.');
    expect(waitedFor(120)).toBe('2 ชม.');
  });

  it('เกินชั่วโมงบอกทั้งชั่วโมงและนาทีที่เหลือ', () => {
    expect(waitedFor(90)).toBe('1 ชม. 30 นาที');
    expect(waitedFor(219)).toBe('3 ชม. 39 นาที');
  });

  it('เกินวันบอกเป็นวัน ไม่งั้นเลขชั่วโมงก็ยาวจนอ่านไม่ออกอยู่ดี', () => {
    expect(waitedFor(1440)).toBe('1 วัน');
    expect(waitedFor(1500)).toBe('1 วัน 1 ชม.');
    expect(waitedFor(2880)).toBe('2 วัน');
  });

  it('ค่าติดลบหรือศูนย์ต้องไม่พังและไม่โชว์ค่าประหลาด', () => {
    expect(waitedFor(0)).toBe('0 นาที');
    expect(waitedFor(-5)).toBe('0 นาที');
  });
});
