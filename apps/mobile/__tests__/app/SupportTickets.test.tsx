import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { CustomerStack } from '../../src/app/navigators/CustomerStack';
import { AdminStack } from '../../src/app/navigators/AdminStack';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
let client: QueryClient | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  client?.clear();
  client = null;
  r = null;
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function findAny(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = findAny(root, id).find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error(`ไม่พบสิ่งที่กดได้: ${id}`);
  return node;
}
function input(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = findAny(root, id).find((n) => typeof n.props?.onChangeText === 'function');
  if (!node) throw new Error(`ไม่พบช่องกรอก: ${id}`);
  return node;
}
function collect(node: ReactTestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(collect).join(' ');
}
async function flush() {
  for (let i = 0; i < 15; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render(stack: 'customer' | 'admin') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  client = qc;
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            {stack === 'customer' ? <CustomerStack /> : <AdminStack />}
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

/** ลูกค้าเปิดตั๋วหนึ่งใบไว้ล่วงหน้า แล้วคืน id */
async function openTicketAsCustomer(subject = 'อาหารมาไม่ครบ') {
  let id = '';
  await act(async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const res = await repos.support.open({
      kind: 'order_problem', subject, body: 'สั่งสองจาน ได้จานเดียว',
    });
    id = res.id;
  });
  return id;
}

describe('ตั๋วซัพพอร์ตฝั่งลูกค้า (AD4)', () => {
  beforeEach(async () => {
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
  });

  it('เปิดตั๋วจากโปรไฟล์แล้วเข้าไปเห็นเธรดของตัวเอง', async () => {
    const result = render('customer');
    await flush();

    await act(async () => {
      pressable(result.root, 'tab-Profile').props.onPress();
    });
    await flush();
    await act(async () => {
      pressable(result.root, 'btn-support').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'screen-support').length).toBe(1);

    await act(async () => {
      pressable(result.root, 'btn-new-ticket').props.onPress();
    });
    await flush();

    // หัวข้อกับรายละเอียดยังว่าง = ส่งไม่ได้ ตั๋วเปล่าคือคิวที่แอดมินต้องไล่ถามใหม่ทุกใบ
    expect(pressable(result.root, 'btn-open-ticket').props.disabled).toBe(true);

    await act(async () => {
      input(result.root, 'input-subject').props.onChangeText('จ่ายเงินซ้ำ');
    });
    await flush();
    await act(async () => {
      input(result.root, 'input-body').props.onChangeText('โดนตัดเงินสองรอบ');
    });
    await flush();
    await act(async () => {
      pressable(result.root, 'btn-open-ticket').props.onPress();
    });
    await flush();

    // กดส่งแล้วต้องพาเข้าเธรดเลย ไม่ใช่เด้งกลับไปรายการให้หาเอง
    expect(findAll(result.root, 'screen-support-ticket').length).toBe(1);
    const mine = await repos.support.mine();
    expect(mine.some((t) => t.subject === 'จ่ายเงินซ้ำ')).toBe(true);
  });

  it('ข้อความแรกที่พิมพ์ตอนเปิดอยู่ในเธรด ไม่ใช่หายไป', async () => {
    const id = await openTicketAsCustomer('อาหารเย็นชืด');
    const thread = await repos.support.thread(id);
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0]!.body).toContain('สั่งสองจาน');
    expect(thread.messages[0]!.fromStaff).toBe(false);
  });

  it('ตั๋วของคนอื่นอ่านไม่ได้ แม้จะรู้ id', async () => {
    const id = await openTicketAsCustomer();
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    await expect(repos.support.thread(id)).rejects.toThrow();
  });

  it('ผูกออร์เดอร์ของคนอื่นไม่ได้', async () => {
    let orderId = '';
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
      const order = await repos.orders.create({
        restaurantId: 'r-malee',
        items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
        paymentMethod: 'promptpay',
      });
      orderId = order.id;
      await useAuthStore.getState().login('rider_ann', '1234');
    });

    await expect(repos.support.open({
      orderId, kind: 'order_problem', subject: 'ขอดูใบนี้', body: 'อยากรู้',
    })).rejects.toThrow();
  });
});

describe('ตั๋วซัพพอร์ตฝั่งแอดมิน (AD4)', () => {
  it('ตั๋วที่ลูกค้าเปิดโผล่ในคิว และทำเครื่องหมายว่ายังไม่มีใครตอบ', async () => {
    const id = await openTicketAsCustomer('ของหาย');
    await act(async () => {
      await useAuthStore.getState().login('admin_root', '1234');
    });

    const result = render('admin');
    await flush();
    await act(async () => {
      pressable(result.root, 'admin-tab-AdminSupport').props.onPress();
    });
    await flush();

    expect(findAll(result.root, `admin-ticket-${id}`).length).toBe(1);
    expect(findAll(result.root, `admin-ticket-unanswered-${id}`).length).toBe(1);
  });

  it('แอดมินตอบแล้วข้อความติดป้ายว่ามาจากทีมงาน และตั๋วเลิกขึ้นว่ายังไม่มีใครตอบ', async () => {
    const id = await openTicketAsCustomer('ขอใบเสร็จ');
    await act(async () => {
      await useAuthStore.getState().login('admin_root', '1234');
    });

    const result = render('admin');
    await flush();
    await act(async () => {
      pressable(result.root, 'admin-tab-AdminSupport').props.onPress();
    });
    await flush();
    await act(async () => {
      pressable(result.root, `admin-ticket-${id}`).props.onPress();
    });
    await flush();

    await act(async () => {
      input(result.root, 'input-reply').props.onChangeText('ส่งให้ทางอีเมลแล้วครับ');
    });
    await flush();
    await act(async () => {
      pressable(result.root, 'btn-send-reply').props.onPress();
    });
    await flush();

    const thread = await repos.support.thread(id);
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[1]!.fromStaff).toBe(true);
  });

  it('ปิดตั๋วแล้วช่องพิมพ์หายและบอกว่าทำไม', async () => {
    const id = await openTicketAsCustomer('สอบถาม');
    await act(async () => {
      await useAuthStore.getState().login('admin_root', '1234');
    });

    const result = render('admin');
    await flush();
    await act(async () => {
      pressable(result.root, 'admin-tab-AdminSupport').props.onPress();
    });
    await flush();
    await act(async () => {
      pressable(result.root, `admin-ticket-${id}`).props.onPress();
    });
    await flush();
    await act(async () => {
      pressable(result.root, 'btn-close-ticket').props.onPress();
    });
    await flush();

    expect(findAny(result.root, 'input-reply').length).toBe(0);
    expect(findAll(result.root, 'ticket-closed-note').length).toBe(1);
    // ตั๋วที่ปิดแล้วต้องตอบไม่ได้จริง ไม่ใช่แค่ซ่อนช่อง
    await expect(repos.support.reply(id, 'ยังไม่จบนะ')).rejects.toThrow();
  });

  /** §5.6 ตั๋วไม่เคยทำให้เงินขยับ ปุ่มไปเคสคืนเงินจึงโผล่เฉพาะตอนที่เคสนั้นมีอยู่จริง */
  it('ไม่มีทางคืนเงินจากในตั๋ว', async () => {
    const id = await openTicketAsCustomer('อยากได้เงินคืน');
    await act(async () => {
      await useAuthStore.getState().login('admin_root', '1234');
    });

    const result = render('admin');
    await flush();
    await act(async () => {
      pressable(result.root, 'admin-tab-AdminSupport').props.onPress();
    });
    await flush();
    await act(async () => {
      pressable(result.root, `admin-ticket-${id}`).props.onPress();
    });
    await flush();

    const screen = collect(findAny(result.root, 'screen-admin-ticket')[0]!);
    expect(findAny(result.root, 'btn-go-refund').length).toBe(0);
    expect(screen).not.toContain(i18n.t('admin.approve.title'));
  });
});
