import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderDocumentsScreen } from '../../src/features/rider/screens/RiderDocumentsScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';
import { pickImage } from '../../src/lib/media/pickImage';

/** mock เฉพาะตัวเลือกรูป เปิดคลังรูปจริงในเทสต์ไม่ได้ */
jest.mock('../../src/lib/media/pickImage', () => ({ pickImage: jest.fn() }));
const pickImageMock = pickImage as jest.MockedFunction<typeof pickImage>;

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

beforeEach(() => {
  pickImageMock.mockReset();
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [], activeCapability: null,
  } as never);
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
function pressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = root
    .findAll((n) => n.props?.testID === id)
    .find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error(`ไม่พบแถวที่กดได้: ${id}`);
  return node;
}
function textOf(root: ReactTestRenderer.ReactTestInstance, id: string): string {
  return findAll(root, id)
    .flatMap((n) => n.findAll((c) => typeof c.type === 'string' && typeof c.props?.children === 'string'))
    .map((n) => String(n.props.children))
    .join(' ');
}
function screenText(root: ReactTestRenderer.ReactTestInstance): string {
  return root
    .findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string')
    .map((n) => String(n.props.children))
    .join(' ');
}
async function flush() {
  for (let i = 0; i < 12; i += 1) {
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
  act(() => {
    r?.unmount();
  });
  client?.clear();
  client = qc;
  act(() => {
    r = ReactTestRenderer.create(
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">
          <NavigationContainer>
            <RiderDocumentsScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ key: 'k', name: 'RiderDocuments' } as never}
            />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

const KINDS = ['selfie', 'id_card_front', 'id_card_back', 'licence', 'vehicle_book', 'insurance'];

describe('RiderDocumentsScreen — เอกสารของฉัน (R8)', () => {
  beforeEach(async () => {
    await act(async () => {
      await useAuthStore.getState().login('rider_ann', '1234');
    });
  });

  /** §7 บังคับหกชิ้น จอต้องโชว์ครบเสมอ ไม่ใช่เฉพาะที่ส่งไปแล้ว */
  it('โชว์เอกสารครบหกชิ้นตั้งแต่ยังไม่ส่งอะไรเลย', async () => {
    const result = render();
    await flush();

    expect(findAll(result.root, 'screen-rider-documents').length).toBe(1);
    for (const kind of KINDS) {
      expect(findAll(result.root, `document-${kind}`).length).toBe(1);
    }
    expect(textOf(result.root, 'documents-progress')).toContain('0/6');
  });

  it('กดแถวแล้วเลือกรูป สถานะเปลี่ยนเป็นรอตรวจ', async () => {
    pickImageMock.mockResolvedValue({ uri: 'file:///tmp/a.jpg', ext: 'jpg' });
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'document-licence').props.onPress();
    });
    await flush();

    expect(pickImageMock).toHaveBeenCalled();
    const docs = await repos.rider.documents();
    expect(docs.find((d) => d.kind === 'licence')!.status).toBe('reviewing');
    expect(screenText(result.root)).toContain(i18n.t('rider.documents.status.reviewing'));
  });

  /** ยกเลิกไม่ใช่ข้อผิดพลาด ต้องไม่ขึ้น error และต้องไม่อัปอะไร */
  it('ยกเลิกตอนเลือกรูป ไม่อัปและไม่ขึ้น error', async () => {
    pickImageMock.mockResolvedValue(null);
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'document-selfie').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'documents-error').length).toBe(0);
    const docs = await repos.rider.documents();
    expect(docs.find((d) => d.kind === 'selfie')!.status).toBe('missing');
  });

  /** เหตุผลที่ไม่ผ่านต้องอยู่ติดกับใบที่ไม่ผ่าน */
  it('เอกสารที่ไม่ผ่านโชว์เหตุผลติดกับใบนั้น', async () => {
    pickImageMock.mockResolvedValue({ uri: 'file:///tmp/a.jpg', ext: 'jpg' });
    await act(async () => {
      await repos.rider.uploadDocument('insurance', { uri: 'file:///tmp/a.jpg', ext: 'jpg' });
      await useAuthStore.getState().login('admin_root', '1234');
      await repos.admin.decideRiderDocument('u-ann', 'insurance', {
        approve: false,
        rejectionReason: 'พ.ร.บ. หมดอายุแล้ว',
      });
      await useAuthStore.getState().login('rider_ann', '1234');
    });

    const result = render();
    await flush();

    expect(textOf(result.root, 'document-reason-insurance')).toContain('พ.ร.บ. หมดอายุแล้ว');
    // ใบอื่นต้องไม่มีกล่องเหตุผลโผล่มาด้วย
    expect(findAll(result.root, 'document-reason-selfie').length).toBe(0);
  });

  it('อัปโหลดพังแล้วขึ้นข้อความบอก ไม่ใช่เงียบ', async () => {
    pickImageMock.mockResolvedValue({ uri: 'file:///tmp/a.svg', ext: 'svg' });
    const result = render();
    await flush();

    await act(async () => {
      pressable(result.root, 'document-selfie').props.onPress();
    });
    await flush();

    expect(findAll(result.root, 'documents-error').length).toBe(1);
  });
});
