import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { AddMenuItemScreen } from '../../src/features/merchant/screens/AddMenuItemScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
});
let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});
function findAll(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
function first(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const n = findAll(root, id);
  if (n.length === 0) throw new Error(`ไม่พบ testID: ${id}`);
  return n[0];
}
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}
function render(nav: { goBack: jest.Mock }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <AddMenuItemScreen navigation={nav as never} route={{ key: 'k', name: 'AddMenuItem', params: { restaurantId: 'r-malee' } } as never} />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('AddMenuItemScreen', () => {
  it('ปุ่มบันทึก disabled จนกว่าจะกรอกชื่อ+ราคา', () => {
    const result = render({ goBack: jest.fn() });
    expect(first(result.root, 'btn-save').props.disabled).toBe(true);
    act(() => {
      first(result.root, 'input-name').props.onChangeText('ผัดไทย');
      first(result.root, 'input-price').props.onChangeText('55');
    });
    expect(first(result.root, 'btn-save').props.disabled).toBeFalsy();
  });

  it('เพิ่มเมนูพร้อมกลุ่มตัวเลือก 1 กลุ่ม 1 ตัวเลือก → บันทึกลง repo (สตางค์) + goBack', async () => {
    const goBack = jest.fn();
    const result = render({ goBack });
    act(() => {
      first(result.root, 'input-name').props.onChangeText('ผัดไทย');
      first(result.root, 'input-price').props.onChangeText('55');
    });
    act(() => {
      first(result.root, 'btn-add-group').props.onPress();
    });
    act(() => {
      first(result.root, 'input-group-name-0').props.onChangeText('ไข่');
      first(result.root, 'btn-add-choice-0').props.onPress();
    });
    act(() => {
      first(result.root, 'input-choice-name-0-0').props.onChangeText('ไข่ดาว');
      first(result.root, 'input-choice-price-0-0').props.onChangeText('15');
    });
    act(() => {
      first(result.root, 'btn-save').props.onPress();
    });
    await flush();

    const menu = await repos.catalog.getMenu('r-malee');
    const found = menu.find((m) => m.name === 'ผัดไทย');
    expect(found).toBeTruthy();
    expect(found?.price).toBe(5500);
    expect(found?.optionGroups?.[0].name).toBe('ไข่');
    expect(found?.optionGroups?.[0].choices[0].name).toBe('ไข่ดาว');
    expect(found?.optionGroups?.[0].choices[0].priceDelta).toBe(1500);
    expect(goBack).toHaveBeenCalled();
  });
});
