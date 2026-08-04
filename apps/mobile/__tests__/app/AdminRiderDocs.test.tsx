import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { AdminRiderDocsScreen } from '../../src/features/admin/screens/AdminRiderDocsScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    r?.unmount();
  });
  r = null;
});

function findHost(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}
function findAny(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id);
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}

function render(accountId = 'u-ann') {
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
            <AdminRiderDocsScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{
                key: 'k', name: 'AdminRiderDocs', params: { accountId, name: 'แอน' },
              } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

describe('AdminRiderDocsScreen — AD6 ตรวจเอกสาร KYC', () => {
  it('โชว์ครบหกชนิดเสมอ รวมชนิดที่ไรเดอร์ยังไม่ส่ง (§7)', async () => {
    await act(async () => {
      await useAuthStore.getState().login('admin_root', '1234');
    });
    const result = render();
    await flush();

    for (const kind of [
      'selfie', 'id_card_front', 'id_card_back', 'licence', 'vehicle_book', 'insurance',
    ]) {
      expect(findHost(result.root, `admin-doc-${kind}`).length).toBe(1);
    }
  });

  /** ชนิดที่ยังไม่ส่งต้องบอกว่า "ยังไม่ได้ส่ง" ไม่ใช่กล่องว่างที่อ่านได้หลายอย่าง */
  it('ชนิดที่ยังไม่ส่งบอกว่ายังไม่ส่ง และไม่มีปุ่มตัดสิน', async () => {
    await act(async () => {
      await useAuthStore.getState().login('admin_root', '1234');
    });
    const result = render();
    await flush();

    const placeholder = findHost(result.root, 'admin-doc-placeholder-insurance');
    expect(placeholder.length).toBe(1);
    expect(findAny(result.root, 'btn-verify-insurance').length).toBe(0);
    expect(findAny(result.root, 'btn-reject-doc-insurance').length).toBe(0);
  });

  it('ชนิดที่ส่งแล้วมีรูปให้ดูและมีปุ่มตัดสิน', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
      await repos.rider.uploadDocument('licence', { uri: 'file:///tmp/licence.jpg', ext: 'jpg' });
      await useAuthStore.getState().login('admin_root', '1234');
    });
    const result = render();
    await flush();

    const image = findHost(result.root, 'admin-doc-image-licence');
    expect(image.length).toBe(1);
    expect(image[0].props.source.uri).toBe('file:///tmp/licence.jpg');
    expect(findAny(result.root, 'btn-verify-licence').length).toBeGreaterThanOrEqual(1);
  });

  /** รูปโหลดไม่ขึ้นต้องบอกว่าโหลดไม่ขึ้น ไม่ใช่กล่องว่างที่อ่านเหมือน "ไม่ได้ส่งมา" */
  it('รูปโหลดไม่สำเร็จขึ้นข้อความบอก ไม่ใช่กล่องว่าง', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
      await repos.rider.uploadDocument('selfie', { uri: 'file:///tmp/selfie.jpg', ext: 'jpg' });
      await useAuthStore.getState().login('admin_root', '1234');
    });
    const result = render();
    await flush();

    await act(async () => {
      findHost(result.root, 'admin-doc-image-selfie')[0].props.onError();
    });

    const placeholder = findHost(result.root, 'admin-doc-placeholder-selfie');
    expect(placeholder.length).toBe(1);
    const texts = placeholder[0]
      .findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string')
      .map((n) => String(n.props.children));
    expect(texts.join(' ')).toContain(i18n.t('admin.docs.imageFailed'));
  });

  it('ปฏิเสธโดยไม่ใส่เหตุผลกดไม่ได้', async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
      await repos.rider.uploadDocument('id_card_front', { uri: 'file:///tmp/a.jpg', ext: 'jpg' });
      await useAuthStore.getState().login('admin_root', '1234');
    });
    const result = render();
    await flush();

    const reject = findAny(result.root, 'btn-reject-doc-id_card_front')
      .find((n) => n.props?.disabled !== undefined);
    expect(reject?.props.disabled).toBe(true);
  });
});
