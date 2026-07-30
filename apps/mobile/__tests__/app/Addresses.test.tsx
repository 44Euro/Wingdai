import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { AddressesScreen } from '../../src/features/customer/screens/AddressesScreen';
import { AddAddressScreen } from '../../src/features/customer/screens/AddAddressScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
  // locale ของเครื่องทดสอบเป็นอังกฤษ — บังคับไทยเพื่อให้เทียบข้อความได้ตรง
  await i18n.changeLanguage('th');
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
let qc: QueryClient | null = null;

afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
  /*
   * ต้องล้าง QueryClient เอง ไม่ใช่แค่ unmount
   * react-query ตั้ง timer ไว้ข้างในสำหรับเก็บ cache ซึ่งค้างต่อหลังจอถูกถอด
   * แล้วทำให้ jest ไม่ยอมจบ (ต้องสั่ง --forceExit ซึ่งจะกลบ leak จริงในอนาคตด้วย)
   */
  qc?.clear();
  qc?.unmount();
  qc = null;
  // store เป็นระดับโมดูล ค้างข้ามเทสต์ — คืนสภาพเป็นยังไม่ล็อกอิน
  useAuthStore.setState({ account: null } as never);
  jest.restoreAllMocks();
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}

/** node ที่กดได้จริง (Pressable ข้างใน) ไม่ใช่ composite ตัวนอกที่ testID ซ้ำกัน */
function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0]!;
}

function textOf(root: ReactTestRenderer.ReactTestInstance, id: string): string | undefined {
  return findAll(root, id).find((n) => typeof n.props.children === 'string')?.props.children;
}

/**
 * นับ "จำนวนชิ้นที่เห็นบนจอ" — findAll คืนทั้ง composite กับ host ที่ใช้ testID เดียวกัน
 * ทำให้หนึ่งชิ้นนับได้หลายครั้ง (กับดักที่โปรเจกต์นี้เจอซ้ำ ๆ)
 */
function countVisible(root: ReactTestRenderer.ReactTestInstance, id: string): number {
  // host node มี type เป็นสตริง ('Text', 'View') ส่วน composite เป็นฟังก์ชัน
  // นับเฉพาะ host จึงได้จำนวนชิ้นที่เห็นบนจอจริง
  return findAll(root, id).filter((n) => typeof n.type === 'string').length;
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render(node: React.ReactElement) {
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      // mutation ก็มี timer เก็บ cache ของตัวเอง (ค่าตั้งต้น 5 นาที) ไม่ใช่แค่ query
      // ไม่ตั้งเป็น 0 แล้ว jest จะไม่ยอมจบหลังเทสต์ที่ยิง mutation
      mutations: { retry: false, gcTime: 0 },
    },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc!}>
        <ThemeProvider forceScheme="light">{node}</ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const nav = { goBack: jest.fn(), navigate: jest.fn() };

describe('AddressesScreen (C9)', () => {
  it('บัญชีที่มีที่อยู่แล้วเห็นรายการ และที่อยู่ตัวแรกถูกทำเครื่องหมายว่าเป็นค่าเริ่มต้น', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account } as never);

    const result = render(
      <AddressesScreen navigation={nav as never} route={{ key: 'k', name: 'Addresses' } as never} />,
    );
    await flush();

    // ค่าเริ่มต้นต้องมีแค่หนึ่ง ไม่ใช่ติดทุกใบ — ต้องตรงกับที่เซิร์ฟเวอร์เลือกเมื่อออร์เดอร์ไม่ระบุ
    expect(countVisible(result.root, 'address-default-tag')).toBe(1);
  });

  it('กดเพิ่มที่อยู่ → ไปจอ C29', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account } as never);
    const result = render(
      <AddressesScreen navigation={nav as never} route={{ key: 'k', name: 'Addresses' } as never} />,
    );
    await flush();

    nav.navigate.mockClear();
    await act(async () => {
      pressable(result.root, 'btn-add-address').props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('AddAddress');
  });
});

describe('AddAddressScreen (C29)', () => {
  function renderAdd() {
    return render(
      <AddAddressScreen navigation={nav as never} route={{ key: 'k', name: 'AddAddress' } as never} />,
    );
  }

  it('ยังไม่กดหาตำแหน่ง → บอกว่ายังไม่มีพิกัด', () => {
    const result = renderAdd();
    expect(textOf(result.root, 'address-coords')).toContain('ยังไม่ได้ระบุ');
  });

  /**
   * ไม่มีพิกัดแล้วบันทึกไม่ได้ และห้ามแทนด้วยจุดกลางโซน
   * เพราะไรเดอร์จะถูกส่งไปผิดที่โดยไม่มีใครรู้ว่าพิกัดเป็นค่าเดา
   */
  it('กรอกครบแต่ยังไม่มีพิกัด → บันทึกไม่ได้ และบอกให้กดหาตำแหน่งก่อน', async () => {
    const result = renderAdd();
    const spy = jest.spyOn(repos.addresses, 'add');

    act(() => {
      findAll(result.root, 'input-address-label')[0]!.props.onChangeText('บ้าน');
      findAll(result.root, 'input-address-text')[0]!.props.onChangeText('ซอยอารีย์ 5');
    });
    await act(async () => {
      pressable(result.root, 'btn-save-address').props.onPress();
    });

    expect(textOf(result.root, 'address-error')).toContain('ตำแหน่งปัจจุบัน');
    expect(spy).not.toHaveBeenCalled();
  });

  it('ไม่กรอกชื่อเรียก/ที่อยู่ → ขึ้น error ก่อนถึงเรื่องพิกัด', async () => {
    const result = renderAdd();
    await act(async () => {
      pressable(result.root, 'btn-save-address').props.onPress();
    });
    expect(textOf(result.root, 'address-error')).toContain('ชื่อเรียก');
  });

  it('กดใช้ตำแหน่งปัจจุบัน → จับพิกัดได้แล้วบันทึกสำเร็จ', async () => {
    const account = await repos.auth.login('somchai', '1234');
    useAuthStore.setState({ account } as never);
    const result = renderAdd();
    const spy = jest.spyOn(repos.addresses, 'add');

    act(() => {
      findAll(result.root, 'input-address-label')[0]!.props.onChangeText('หอพัก');
      findAll(result.root, 'input-address-text')[0]!.props.onChangeText('ซอยอารีย์ 5 ห้อง 301');
    });
    await act(async () => {
      await pressable(result.root, 'btn-use-location').props.onPress();
    });
    expect(textOf(result.root, 'address-coords')).toContain('บันทึกแล้ว');

    nav.goBack.mockClear();
    await act(async () => {
      await pressable(result.root, 'btn-save-address').props.onPress();
    });
    await flush();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'หอพัก', lat: 13.7797, lng: 100.5418 }),
    );
    expect(nav.goBack).toHaveBeenCalled();
  });

  /** ปฏิเสธสิทธิ์แล้วต้องบอกว่าทำไมต้องใช้ ไม่ใช่เงียบหรือบันทึกด้วยพิกัดเดา */
  it('ไม่อนุญาตให้เข้าถึงตำแหน่ง → ขึ้นเหตุผล ไม่บันทึก', async () => {
    jest
      .spyOn(Location, 'requestForegroundPermissionsAsync')
      .mockResolvedValue({ status: 'denied' } as never);

    const result = renderAdd();
    await act(async () => {
      await pressable(result.root, 'btn-use-location').props.onPress();
    });

    expect(textOf(result.root, 'address-error')).toContain('อนุญาต');
    expect(textOf(result.root, 'address-coords')).toContain('ยังไม่ได้ระบุ');
  });
});
