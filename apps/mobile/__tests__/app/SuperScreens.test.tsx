import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { SuperAdminStack } from '../../src/app/navigators/SuperAdminStack';
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
/** ข้อความทั้งหมดใต้ node หนึ่ง ใช้ตรวจว่าแถวไหนโผล่/ไม่โผล่ในการ์ด */
function collect(node: ReactTestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(collect).join(' ');
}
function textUnder(root: ReactTestRenderer.ReactTestInstance, id: string): string {
  const node = findAny(root, id)[0];
  if (!node) throw new Error(`ไม่พบ: ${id}`);
  return collect(node);
}
async function flush() {
  for (let i = 0; i < 15; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render() {
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
            <SuperAdminStack />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

async function goToTab(result: ReactTestRenderer.ReactTestRenderer, tab: string) {
  await act(async () => {
    pressable(result.root, `super-tab-${tab}`).props.onPress();
  });
  await flush();
}

beforeEach(async () => {
  await act(async () => {
    await useAuthStore.getState().login('super_root', '1234');
  });
});

describe('SA1 — ตัวเลข §8', () => {
  it('ค่าที่ยังวัดไม่ได้ซ่อนทั้งแถว ไม่แสดง 0 หรือขีด', async () => {
    const result = render();
    await flush();

    const dump = textUnder(result.root, 'admin-metrics');
    // ยังไม่มีออร์เดอร์สักใบ = ยังไม่มีเวลาส่งให้วัด แถวนั้นต้องไม่โผล่เลย
    expect(dump).not.toContain(i18n.t('admin.metric.medianDelivery'));
    // §8 North Star ตัวนี้ mock ไม่มีข้อมูลพอ จึงต้องซ่อนเสมอ ไม่ใช่โชว์ 0.00
    expect(dump).not.toContain(i18n.t('admin.metric.ordersPerRiderHour'));
  });

  it('มีออร์เดอร์ที่ส่งถึงแล้วจึงโผล่ตัวเลขที่วัดได้', async () => {
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
      const order = await repos.orders.create({
        restaurantId: 'r-malee',
        items: [{ menuItemId: 'm-malee-1', quantity: 1, choiceIds: ['c-spicy-mid'] }],
        paymentMethod: 'promptpay',
      });
      await repos.orders.updateStatus(order.id, 'accepted');
      await useAuthStore.getState().login('rider_ann', '1234');
      await repos.rider.acceptOffer(order.id);
      await repos.orders.updateStatus(order.id, 'preparing');
      await repos.orders.updateStatus(order.id, 'picked_up');
      await repos.orders.updateStatus(order.id, 'delivered', { deliveryPin: order.deliveryPin, photoPath: 'rider-docs/proof.jpg' });
      await useAuthStore.getState().login('super_root', '1234');
    });

    const result = render();
    await flush();

    const dump = textUnder(result.root, 'admin-metrics');
    expect(dump).toContain(i18n.t('admin.metric.medianDelivery'));
    expect(dump).toContain(i18n.t('admin.metric.promptPayRate'));
  });

  it('เปลี่ยนหน้าต่างเวลาแล้วหัวการ์ดเปลี่ยนตาม', async () => {
    const result = render();
    await flush();
    const before = textUnder(result.root, 'admin-metrics');
    expect(before).toContain(i18n.t('admin.metric.title', { days: 30 }));

    await act(async () => {
      pressable(result.root, 'super-window-90').props.onPress();
    });
    await flush();

    const after = textUnder(result.root, 'admin-metrics');
    expect(after).toContain(i18n.t('admin.metric.title', { days: 90 }));
  });
});

describe('SA2 — โซน', () => {
  it('เพิ่มโซนแล้วโผล่ในรายการทันที', async () => {
    const result = render();
    await goToTab(result, 'SuperZones');

    await act(async () => {
      pressable(result.root, 'btn-add-zone').props.onPress();
    });
    await flush();

    /** กรอกทีละครั้งแล้วรอ re-render กดสองอย่างใน act เดียวกันจะใช้ state ก้อนเก่าทั้งคู่ */
    await act(async () => {
      input(result.root, 'input-zone-name').props.onChangeText('สยาม');
    });
    await flush();
    await act(async () => {
      pressable(result.root, 'zone-type-office_district').props.onPress();
    });
    await flush();
    await act(async () => {
      pressable(result.root, 'btn-save-zone').props.onPress();
    });
    await flush();

    const zones = await repos.super.zones();
    const siam = zones.find((z) => z.name === 'สยาม');
    expect(siam).toBeDefined();
    expect(siam!.type).toBe('office_district');
    expect(findAll(result.root, `super-zone-${siam!.id}`).length).toBe(1);
  });

  it('ชื่อว่างกดบันทึกไม่ได้ · พิกัดผิดบอกว่าผิดตรงไหน', async () => {
    const result = render();
    await goToTab(result, 'SuperZones');

    await act(async () => {
      pressable(result.root, 'btn-add-zone').props.onPress();
    });
    await flush();

    expect(pressable(result.root, 'btn-save-zone').props.disabled).toBe(true);

    await act(async () => {
      input(result.root, 'input-zone-name').props.onChangeText('ทดสอบ');
    });
    await flush();
    await act(async () => {
      input(result.root, 'input-zone-lat').props.onChangeText('999');
    });
    await flush();

    expect(findAll(result.root, 'zone-coords-error').length).toBe(1);
    expect(pressable(result.root, 'btn-save-zone').props.disabled).toBe(true);
  });
});

describe('SA4+SA6 — ตั้งค่า', () => {
  it('ยังไม่แก้อะไรกดบันทึกไม่ได้', async () => {
    const result = render();
    await goToTab(result, 'SuperConfig');
    expect(pressable(result.root, 'btn-save-pricing').props.disabled).toBe(true);
  });

  it('แก้ค่าคอมต้องยืนยันอีกชั้น และกล่องยืนยันบอกค่าเก่า→ค่าใหม่', async () => {
    const result = render();
    await goToTab(result, 'SuperConfig');

    await act(async () => {
      input(result.root, 'input-commission').props.onChangeText('12');
    });
    await flush();

    // §6.1 ห้ามให้ตัวเลขนี้เลื่อนเงียบ ๆ กดบันทึกแล้วต้องยังไม่เปลี่ยนจนกว่าจะยืนยัน
    await act(async () => {
      pressable(result.root, 'btn-save-pricing').props.onPress();
    });
    await flush();
    expect((await repos.super.config()).pricing.commissionRateBp).toBe(1500);
    expect(textUnder(result.root, 'change-commission')).toContain('15%');
    expect(textUnder(result.root, 'change-commission')).toContain('12%');

    await act(async () => {
      pressable(result.root, 'confirm-pricing').props.onPress();
    });
    await flush();
    expect((await repos.super.config()).pricing.commissionRateBp).toBe(1200);
  });

  it('ยอดที่ไม่ลงตัวเป็นสตางค์กดบันทึกไม่ได้', async () => {
    const result = render();
    await goToTab(result, 'SuperConfig');

    await act(async () => {
      input(result.root, 'input-delivery-base').props.onChangeText('15.005');
    });
    await flush();

    expect(findAll(result.root, 'pricing-error').length).toBe(1);
    expect(pressable(result.root, 'btn-save-pricing').props.disabled).toBe(true);
  });

  it('อัตราค่าคอมนอกช่วง 1–30% กดบันทึกไม่ได้', async () => {
    const result = render();
    await goToTab(result, 'SuperConfig');

    await act(async () => {
      input(result.root, 'input-commission').props.onChangeText('45');
    });
    await flush();

    expect(findAll(result.root, 'pricing-rate-error').length).toBe(1);
    expect(pressable(result.root, 'btn-save-pricing').props.disabled).toBe(true);
  });

  /** สวิตช์ต้องเปลี่ยนพฤติกรรมจริง ไม่ใช่แค่ค่าที่จอตัวเองอ่านกลับมา (สเปค §5.4) */
  it('ปิดรับเงินสดแล้วเงินสดหลุดจากช่องทางที่แอปเห็น', async () => {
    const result = render();
    await goToTab(result, 'SuperConfig');
    expect((await repos.config.get()).paymentMethods).toContain('cash');

    await act(async () => {
      pressable(result.root, 'flag-cash_payment').props.onPress();
    });
    await flush();

    expect((await repos.config.get()).paymentMethods).not.toContain('cash');
  });
});

describe('SA3 — สิทธิ์ผู้ดูแลระบบ', () => {
  async function openRoles() {
    const result = render();
    await flush();
    await act(async () => {
      pressable(result.root, 'btn-super-roles').props.onPress();
    });
    await flush();
    return result;
  }

  it('แถวของตัวเองไม่มีปุ่มเปลี่ยนสิทธิ์ และบอกว่าทำไม', async () => {
    const result = await openRoles();
    expect(findAll(result.root, 'super-admin-self-u-super').length).toBe(1);
    expect(findAny(result.root, 'btn-role-u-super').length).toBe(0);
    expect(findAny(result.root, 'btn-revoke-u-super').length).toBe(0);
  });

  it('ยกแอดมินขึ้นเป็นซูเปอร์แอดมินได้ ผ่านกล่องยืนยัน', async () => {
    const result = await openRoles();

    await act(async () => {
      pressable(result.root, 'btn-role-u-admin').props.onPress();
    });
    await flush();
    // ยังไม่ยืนยัน = ยังไม่เปลี่ยน
    expect((await repos.super.admins()).find((a) => a.accountId === 'u-admin')!.role)
      .toBe('admin');

    await act(async () => {
      pressable(result.root, 'confirm-role').props.onPress();
    });
    await flush();

    expect((await repos.super.admins()).find((a) => a.accountId === 'u-admin')!.role)
      .toBe('super_admin');
  });
});

describe('SA5 — ประวัติ', () => {
  it('เปลี่ยนค่าธรรมเนียมแล้วโผล่ในประวัติพร้อมค่าเก่า→ค่าใหม่ และไม่มีปุ่มลบ', async () => {
    await act(async () => {
      await repos.super.setPricing({
        commissionRateBp: 1400,
        deliveryBaseSatang: 1500,
        deliveryPerKmSatang: 600,
        serviceFeeSatang: 500,
      });
    });

    const result = render();
    await goToTab(result, 'SuperAudit');

    const rows = await repos.super.audit();
    const row = rows.find((x) => x.action === 'pricing.changed')!;
    const dump = textUnder(result.root, `audit-${row.id}`);

    /** เทียบกับค่าที่ audit บันทึกไว้จริง ไม่ใช่เลขตายตัว เทสต์ในไฟล์นี้ใช้ mock ก้อนเดียวกัน */
    const before = (row.before as { commissionRateBp: number }).commissionRateBp;
    expect(dump).toContain(String(before));
    expect(dump).toContain('1400');
    expect(dump).toContain(i18n.t('super.audit.action.pricing_changed'));
    // log ที่ลบได้ไม่ใช่หลักฐาน จอนี้ต้องไม่มีทางลบตลอดไป
    expect(dump).not.toContain('ลบ');
  });

  it('กรองตามกลุ่มแล้วรายการเปลี่ยนจริง', async () => {
    await act(async () => {
      await repos.super.setFlag('auto_dispatch', false);
    });

    const result = render();
    await goToTab(result, 'SuperAudit');

    const rows = await repos.super.audit();
    const flagRow = rows.find((x) => x.action === 'flag.changed')!;
    expect(findAll(result.root, `audit-${flagRow.id}`).length).toBe(1);

    await act(async () => {
      pressable(result.root, 'audit-filter-access').props.onPress();
    });
    await flush();

    // ชิปที่กรองแล้วได้รายการเดิมทุกอันคือชิปที่กดแล้วไม่เกิดอะไร
    expect(findAll(result.root, `audit-${flagRow.id}`).length).toBe(0);
  });
});
