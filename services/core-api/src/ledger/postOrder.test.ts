import { describe, it, expect } from 'vitest';
import { postOrderDelivered, totalsOf, type PaymentMethod } from './postOrder';
import { commissionOf } from '../db/schema/money';

/**
 * claude.md §5 กติกาข้อ 3 — ต้องพิสูจน์ว่าเดบิต = เครดิต แบบกวาดหลายรูปแบบ
 * ไม่ใช่เช็คตัวอย่างเดียวแล้วจบ เพราะบั๊กบัญชีมักโผล่ตอนเจอตัวเลขปัดเศษแปลก ๆ
 */
describe('postOrderDelivered', () => {
  // ตัวอย่างเดียวกับ claude.md §6.2 แต่ cash เดบิตยอด "สุทธิหลังหักค่าธรรมเนียม"
  // ไม่ใช่ยอดเต็ม — ดูเหตุผลในคอมเมนต์ของ postOrderDelivered
  it('แตกยอดออร์เดอร์ ฿170 ที่จ่ายผ่านเกตเวย์ได้ถูกต้อง', () => {
    const lines = postOrderDelivered({
      foodTotalSatang: 15000, // ฿150
      deliveryFeeSatang: 1500, // ฿15
      serviceFeeSatang: 500, // ฿5
      riderPaySatang: 3000, // ฿30
      paymentFeeSatang: 136, // ฿1.36
      method: 'promptpay',
    });

    const byAccount = Object.fromEntries(lines.map((l) => [l.account, l]));
    expect(byAccount.cash?.debitSatang).toBe(16864); // ฿170 − ค่าธรรมเนียม ฿1.36
    expect(byAccount.restaurant_payable?.creditSatang).toBe(12750);
    expect(byAccount.rider_payable?.creditSatang).toBe(3000);
    expect(byAccount.payment_fee_expense?.debitSatang).toBe(136);
    expect(byAccount.platform_revenue?.creditSatang).toBe(1250);

    const { debit, credit } = totalsOf(lines);
    expect(debit).toBe(credit);
  });

  it('เงินสด: เงินเข้า rider_cash_held ไม่ใช่ cash และไม่มีค่าธรรมเนียมเกตเวย์', () => {
    const lines = postOrderDelivered({
      foodTotalSatang: 15000,
      deliveryFeeSatang: 1500,
      serviceFeeSatang: 500,
      riderPaySatang: 3000,
      paymentFeeSatang: 0,
      method: 'cash',
    });

    const accounts = lines.map((l) => l.account);
    expect(accounts).toContain('rider_cash_held');
    expect(accounts).not.toContain('cash');
    expect(accounts).not.toContain('payment_fee_expense');

    // ไรเดอร์ไม่ได้จ่ายค่าอาหาร — ร้านยังได้ยอดเต็มจากแพลตฟอร์มเหมือนเดิม
    const restaurant = lines.find((l) => l.account === 'restaurant_payable');
    expect(restaurant?.creditSatang).toBe(12750);
  });

  // §6.5 บอกว่าค่าธรรมเนียมที่ต่างกันมีผลกับ unit economics จริง — เทสต์นี้กันไม่ให้หายไป
  it('เงินสดทำให้เงินเข้าบริษัทมากกว่า เพราะไม่มีค่าธรรมเนียมเกตเวย์', () => {
    const base = {
      foodTotalSatang: 15000,
      deliveryFeeSatang: 1500,
      serviceFeeSatang: 500,
      riderPaySatang: 3000,
    };
    const netOf = (method: PaymentMethod, fee: number) => {
      const lines = postOrderDelivered({ ...base, paymentFeeSatang: fee, method });
      const revenue = lines.find((l) => l.account === 'platform_revenue')!.creditSatang;
      const expense = lines.find((l) => l.account === 'payment_fee_expense')?.debitSatang ?? 0;
      return revenue - expense;
    };

    expect(netOf('cash', 0)).toBe(1250);
    expect(netOf('promptpay', 136)).toBe(1114);
    expect(netOf('cash', 0)).toBeGreaterThan(netOf('promptpay', 136));
  });

  it('คอมมิชชันคิดจากค่าอาหารเท่านั้น ไม่รวมค่าส่ง/ค่าบริการ (§6.1)', () => {
    // เพิ่มค่าส่งกับค่าบริการเท่าไหร่ ร้านก็ต้องได้เท่าเดิม
    const restaurantPayableFor = (deliveryFee: number, serviceFee: number) =>
      postOrderDelivered({
        foodTotalSatang: 20000,
        deliveryFeeSatang: deliveryFee,
        serviceFeeSatang: serviceFee,
        riderPaySatang: 3000,
        paymentFeeSatang: 0,
        method: 'cash',
      }).find((l) => l.account === 'restaurant_payable')!.creditSatang;

    expect(restaurantPayableFor(1500, 500)).toBe(restaurantPayableFor(9900, 4200));
    expect(restaurantPayableFor(1500, 500)).toBe(20000 - commissionOf(20000));
  });

  it('เดบิต = เครดิต ทุกกรณี แม้ค่าอาหารจะปัดเศษไม่ลงตัว', () => {
    const methods: PaymentMethod[] = ['promptpay', 'cash', 'card'];
    for (let food = 100; food <= 500000; food += 733) {
      for (const method of methods) {
        const lines = postOrderDelivered({
          foodTotalSatang: food,
          deliveryFeeSatang: 1500,
          serviceFeeSatang: 500,
          riderPaySatang: 3000,
          paymentFeeSatang: method === 'cash' ? 0 : Math.floor(food * 0.018),
          method,
        });
        const { debit, credit } = totalsOf(lines);
        expect(debit, `ค่าอาหาร ${food} วิธีจ่าย ${method}`).toBe(credit);
      }
    }
  });

  /**
   * ตาราง ledger_entries มี CHECK ว่าแต่ละแถวต้องเป็นเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง และ > 0
   * แถวที่เป็น 0 ทั้งสองข้างจะถูกฐานปฏิเสธ แล้วพาทรานแซกชันทั้งก้อนล้ม
   * = เปลี่ยนสถานะเป็น delivered ไม่ได้เลย ทั้งที่ดูเหมือนเรื่องเล็ก
   */
  it('ไม่มีแถวที่ยอดเป็นศูนย์ทั้งสองข้าง ต่อให้ไรเดอร์ยังไม่ถูกจ่ายงาน', () => {
    for (const riderPaySatang of [0, 3000]) {
      for (const paymentFeeSatang of [0, 250]) {
        const lines = postOrderDelivered({
          foodTotalSatang: 13000,
          deliveryFeeSatang: 1500,
          serviceFeeSatang: 500,
          riderPaySatang,
          paymentFeeSatang,
          method: 'promptpay',
        });
        for (const l of lines) {
          expect(
            l.debitSatang > 0 !== l.creditSatang > 0,
            `${l.account} เดบิต ${l.debitSatang} เครดิต ${l.creditSatang}`,
          ).toBe(true);
        }
        const { debit, credit } = totalsOf(lines);
        expect(debit).toBe(credit);
      }
    }
  });

  it('ทุกยอดต้องเป็นจำนวนเต็มสตางค์ ใส่ทศนิยมแล้วต้องโยน error', () => {
    expect(() =>
      postOrderDelivered({
        foodTotalSatang: 150.5,
        deliveryFeeSatang: 1500,
        serviceFeeSatang: 500,
        riderPaySatang: 3000,
        paymentFeeSatang: 0,
        method: 'cash',
      }),
    ).toThrow(/จำนวนเต็มสตางค์/);
  });

  it('ออร์เดอร์ที่ขาดทุนยังลงบัญชีครบและบาลานซ์', () => {
    const lines = postOrderDelivered({
      foodTotalSatang: 5000,
      deliveryFeeSatang: 500,
      serviceFeeSatang: 0,
      riderPaySatang: 4000, // จ่ายไรเดอร์มากกว่าที่เก็บค่าส่งได้
      paymentFeeSatang: 0,
      method: 'cash',
    });
    const revenue = lines.find((l) => l.account === 'platform_revenue')!;
    expect(revenue.debitSatang).toBeGreaterThan(0); // ขาดทุน = เดบิตฝั่งรายได้
    const { debit, credit } = totalsOf(lines);
    expect(debit).toBe(credit);
  });
});

describe('commissionOf', () => {
  it('เศษที่ปัดทิ้งตกเป็นของร้าน ไม่ใช่ของแพลตฟอร์ม', () => {
    // 15% ของ 101 สตางค์ = 15.15 → แพลตฟอร์มได้ 15 ร้านได้ 86
    expect(commissionOf(101)).toBe(15);
  });

  it('ไม่รับค่าที่ไม่ใช่จำนวนเต็ม', () => {
    expect(() => commissionOf(100.5)).toThrow();
  });
});
