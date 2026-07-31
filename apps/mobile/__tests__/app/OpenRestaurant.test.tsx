import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import * as Location from 'expo-location';
import { OpenRestaurantScreen } from '../../src/features/merchant/screens/OpenRestaurantScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [], activeCapability: null,
  } as never);
  jest.restoreAllMocks();
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});

function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function findAny(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

/** จำลองว่าเครื่องอยู่ตรงไหน จอนี้ใช้พิกัดจริง ไม่เดาจากข้อความที่อยู่ */
function mockLocationAt(lat: number, lng: number) {
  jest.spyOn(Location, 'getCurrentPositionAsync').mockResolvedValue({
    coords: { latitude: lat, longitude: lng },
  } as never);
}

function render(nav: { goBack: jest.Mock }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <OpenRestaurantScreen
              navigation={nav as never}
              route={{ key: 'k', name: 'OpenRestaurant' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

/** กรอกฟอร์มให้ครบ ยกเว้นพิกัด ซึ่งต้องกดปุ่มแยก */
function fillForm(result: ReactTestRenderer.ReactTestRenderer, name: string) {
  act(() => {
    findAny(result.root, 'input-shop-name')[0].props.onChangeText(name);
    findAny(result.root, 'input-shop-address')[0].props.onChangeText('ซอยอารีย์ 2');
    findAny(result.root, 'input-bank-name')[0].props.onChangeText('กสิกรไทย');
    findAny(result.root, 'input-bank-number')[0].props.onChangeText('9876543210');
    findAny(result.root, 'input-bank-holder')[0].props.onChangeText('สมชาย ใจดี');
  });
}

describe('OpenRestaurantScreen — เปิดร้านของคุณ (§4.3)', () => {
  it('ยังไม่ได้ระบุพิกัด ส่งใบสมัครไม่ได้', async () => {
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
    const result = render({ goBack: jest.fn() });
    await flush();

    expect(findAll(result.root, 'screen-open-restaurant').length).toBe(1);
    fillForm(result, 'ร้านทดสอบ');
    // §1 พิกัดคือสิ่งที่ตัดสินว่าร้านอยู่ในโซนไหม กรอกที่อยู่เป็นข้อความอย่างเดียวไม่พอ
    expect(findAny(result.root, 'btn-submit-restaurant')[0].props.disabled).toBe(true);
  });

  it('กรอกครบ + ระบุพิกัดในโซน แล้วส่งได้', async () => {
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
    mockLocationAt(13.7805, 100.5435);
    const result = render({ goBack: jest.fn() });
    await flush();

    fillForm(result, 'ร้านในโซน');
    await act(async () => {
      findAny(result.root, 'btn-use-location')[0].props.onPress();
    });
    await flush();

    expect(findAny(result.root, 'btn-submit-restaurant')[0].props.disabled).toBe(false);
    await act(async () => {
      findAny(result.root, 'btn-submit-restaurant')[0].props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'restaurant-submitted').length).toBe(1);
  });

  /** ร้านเปิดได้ทุกที่ในประเทศไทย ด่านโซนถูกยกเลิกแล้ว */
  it('ร้านนอกโซนที่วาดไว้เปิดได้ ไม่ถูกปฏิเสธอีกแล้ว', async () => {
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
    });
    mockLocationAt(18.7883, 98.9853); // เชียงใหม่
    const result = render({ goBack: jest.fn() });
    await flush();

    fillForm(result, 'ร้านเชียงใหม่');
    await act(async () => {
      findAny(result.root, 'btn-use-location')[0].props.onPress();
    });
    await flush();
    await act(async () => {
      findAny(result.root, 'btn-submit-restaurant')[0].props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'restaurant-submitted').length).toBe(1);
    expect(findAll(result.root, 'open-error').length).toBe(0);
  });

  /** §4.1 ร้านเป็นการอัปเกรดบนบัญชี user ไรเดอร์เปิดร้านไม่ได้ */
  it('บัญชีไรเดอร์เปิดร้านไม่ได้', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
    mockLocationAt(13.7805, 100.5435);
    const result = render({ goBack: jest.fn() });
    await flush();

    fillForm(result, 'ร้านของไรเดอร์');
    await act(async () => {
      findAny(result.root, 'btn-use-location')[0].props.onPress();
    });
    await flush();
    await act(async () => {
      findAny(result.root, 'btn-submit-restaurant')[0].props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'open-error').length).toBe(1);
  });

  /** §7 ร้านที่อนุมัติแล้วแต่ไม่มีเมนู = ลูกค้ากดเข้าไปเจอหน้าว่าง */
  it('ส่งตรวจไม่ได้จนกว่าจะมีเมนูตั้งต้นครบ 3 รายการ', async () => {
    let shopId = '';
    await act(async () => {
      await useAuthStore.getState().login('somchai', '1234');
      const shop = await repos.merchant.registerRestaurant({
        name: 'ร้านเมนูยังไม่ครบ', cuisine: 'noodle', addressText: 'ซอยอารีย์ 3',
        lat: 13.7805, lng: 100.5435, prepTimeMinutes: 12,
        bankName: 'กสิกรไทย', bankAccountNumber: '1112223334', bankAccountName: 'สมชาย ใจดี',
      });
      shopId = shop.id;
    });

    await expect(repos.merchant.submitForApproval(shopId)).rejects.toThrow();

    await act(async () => {
      for (const dish of ['ต้มยำ', 'เย็นตาโฟ', 'บะหมี่']) {
        // eslint-disable-next-line no-await-in-loop
        await repos.catalog.createMenuItem({
          restaurantId: shopId, name: dish, price: 5500,
          category: 'noodle', isAvailable: true,
        });
      }
    });

    await expect(repos.merchant.submitForApproval(shopId)).resolves.toEqual({ submitted: true });
  });
});
