import { groupByDay } from '../../src/lib/groupByDay';

const at = (iso: string) => new Date(iso).toISOString();

describe('จับกลุ่มรายการตามวัน', () => {
  const rows = [
    { id: 'a', when: at('2026-09-02T11:20:00+07:00'), amount: 100 },
    { id: 'b', when: at('2026-09-02T18:05:00+07:00'), amount: 250 },
    { id: 'c', when: at('2026-09-01T12:00:00+07:00'), amount: 75 },
  ];

  it('รวมรายการวันเดียวกันไว้ด้วยกัน เรียงวันใหม่สุดขึ้นก่อน', () => {
    const groups = groupByDay(rows, (r) => r.when, (r) => r.amount);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.items.map((r) => r.id)).toEqual(['b', 'a']);
    expect(groups[1]!.items.map((r) => r.id)).toEqual(['c']);
  });

  it('มียอดรวมต่อวัน ผู้ใช้จึงไม่ต้องบวกเอง', () => {
    const groups = groupByDay(rows, (r) => r.when, (r) => r.amount);
    expect(groups[0]!.total).toBe(350);
    expect(groups[1]!.total).toBe(75);
  });

  it('ไม่ส่งตัวคิดยอดมาก็ยังจับกลุ่มได้ ยอดรวมเป็นศูนย์', () => {
    const groups = groupByDay(rows, (r) => r.when);
    expect(groups[0]!.total).toBe(0);
  });

  it('ข้ามรายการที่ไม่มีวันเวลา แทนที่จะพังทั้งจอ', () => {
    const groups = groupByDay(
      [...rows, { id: 'd', when: null as unknown as string, amount: 9 }],
      (r) => r.when,
      (r) => r.amount,
    );
    expect(groups.flatMap((g) => g.items).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('แบ่งวันตามเวลาไทย ไม่ใช่เขตเวลาของเครื่อง', () => {
    // 00:30 ของวันที่ 2 ตามเวลาไทย = 17:30 ของวันที่ 1 แบบ UTC ต้องนับเป็นวันที่ 2
    const groups = groupByDay(
      [{ id: 'x', when: '2026-09-01T17:30:00Z' }],
      (r) => r.when,
    );
    expect(groups[0]!.key).toBe('2026-09-02');
  });
});
