import { createMockRepos } from '../../src/data/mock';
import { useCartStore } from '../../src/features/cart/cartStore';

/** ข้อความที่ลูกค้าฝากถึงร้าน ต้องเดินทางจากจอสั่งอาหารไปถึงครัวจริง */
beforeEach(() => {
  useCartStore.setState({ restaurantId: null, lines: [] } as never);
});

const MENU_ITEM = {
  id: 'm-malee-1',
  restaurantId: 'r-malee',
  name: 'ข้าวกะเพราหมูสับ',
  price: 5000,
  category: 'rice' as const,
  isAvailable: true,
};

describe('ข้อความฝากถึงร้าน', () => {
  it('จานเดียวกันแต่คนละหมายเหตุ ต้องแยกบรรทัด ไม่ยุบรวมกัน', () => {
    const cart = useCartStore.getState();
    cart.addLine('r-malee', { menuItem: MENU_ITEM as never, selectedChoices: [], note: 'ไม่ใส่ผักชี' });
    useCartStore.getState().addLine('r-malee', {
      menuItem: MENU_ITEM as never, selectedChoices: [], note: 'เผ็ดน้อย',
    });

    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.note).sort()).toEqual(['เผ็ดน้อย', 'ไม่ใส่ผักชี']);
  });

  /** จานเดียวกัน หมายเหตุเดียวกัน = บรรทัดเดียว จำนวนบวกกัน */
  it('จานเดียวกันหมายเหตุเดียวกัน ยุบเป็นบรรทัดเดียว', () => {
    useCartStore.getState().addLine('r-malee', {
      menuItem: MENU_ITEM as never, selectedChoices: [], note: 'ไม่ใส่ผักชี',
    });
    useCartStore.getState().addLine('r-malee', {
      menuItem: MENU_ITEM as never, selectedChoices: [], note: 'ไม่ใส่ผักชี',
    });

    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantity).toBe(2);
  });

  it('ไม่พิมพ์อะไรก็ไม่มีหมายเหตุติดไป', () => {
    useCartStore.getState().addLine('r-malee', { menuItem: MENU_ITEM as never, selectedChoices: [] });
    expect(useCartStore.getState().lines[0]!.note).toBeUndefined();
  });

  /** เส้นทางเต็ม: สั่ง → ร้านเปิดคิวแล้วต้องเห็นข้อความ */
  it('ข้อความไปถึงคิวออร์เดอร์ของร้านจริง', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');
    await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{
        menuItemId: 'm-malee-1', quantity: 1,
        choiceIds: ['c-spicy-mid'], note: 'ไม่ใส่ผักชี ขอช้อนส้อมด้วย',
      }],
      paymentMethod: 'promptpay',
    });

    await repos.auth.login('malee', '1234');
    const queue = await repos.merchant.listOrders({ scope: 'queue' });
    const mine = queue[0]!;
    expect(mine.items[0]!.note).toBe('ไม่ใส่ผักชี ขอช้อนส้อมด้วย');
  });

  /** ข้อความไม่ใช่ราคา ส่งอะไรมาก็ต้องไม่ขยับยอดเงิน (§10 เซิร์ฟเวอร์คิดเงินเอง) */
  it('ข้อความไม่มีผลกับยอดเงิน', async () => {
    const repos = createMockRepos();
    await repos.auth.login('somchai', '1234');

    const plain = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
      paymentMethod: 'promptpay',
    });
    const noted = await repos.orders.create({
      restaurantId: 'r-malee',
      items: [{
        menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'], note: 'ขอเยอะ ๆ',
      }],
      paymentMethod: 'promptpay',
    });

    expect(noted.foodTotal).toBe(plain.foodTotal);
    expect(noted.items[0]!.unitPrice).toBe(plain.items[0]!.unitPrice);
  });
});
