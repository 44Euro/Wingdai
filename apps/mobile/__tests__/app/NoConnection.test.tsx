import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NoConnectionScreen } from '../../src/app/NoConnectionScreen';
import { useConnectionStore, reportRequestError } from '../../src/app/connectionStore';
import { ApiError } from '../../src/data/http/client';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';

beforeAll(async () => {
  await initI18n();
});
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('th');
  });
  useConnectionStore.setState({ offline: false, reconnecting: false });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id)[0];
}

function render(onRetry = jest.fn().mockResolvedValue(true)) {
  act(() => {
    r = ReactTestRenderer.create(
      <ThemeProvider forceScheme="light">
        <NoConnectionScreen onRetry={onRetry} />
      </ThemeProvider>,
    );
  });
  return { result: r!, onRetry };
}

describe('SY1 จอไม่มีสัญญาณ', () => {
  it('คำขอที่ไปไม่ถึงเซิร์ฟเวอร์ทำให้ขึ้นจอนี้', () => {
    reportRequestError(ApiError.offline());
    expect(useConnectionStore.getState().offline).toBe(true);
  });

  it('เซิร์ฟเวอร์ตอบว่าไม่มีสิทธิ์ ไม่ใช่เน็ตหลุด ห้ามขึ้นจอนี้', () => {
    reportRequestError(new ApiError(403, 'ไม่มีสิทธิ์'));
    expect(useConnectionStore.getState().offline).toBe(false);
  });

  it('error อื่นที่ไม่ใช่ของ API ก็ไม่ทำให้ขึ้นจอนี้', () => {
    reportRequestError(new Error('อะไรสักอย่างพัง'));
    expect(useConnectionStore.getState().offline).toBe(false);
  });

  it('กดลองใหม่แล้วต่อติด จอหายไป', async () => {
    useConnectionStore.setState({ offline: true });
    const { result } = render(jest.fn().mockResolvedValue(true));

    await act(async () => {
      await find(result.root, 'btn-retry-connection').props.onPress();
    });

    expect(useConnectionStore.getState().offline).toBe(false);
  });

  it('กดลองใหม่แล้วยังไม่ติด จอยังอยู่ ไม่ปล่อยเข้าไปเจอจอว่าง', async () => {
    useConnectionStore.setState({ offline: true });
    const { result } = render(jest.fn().mockResolvedValue(false));

    await act(async () => {
      await find(result.root, 'btn-retry-connection').props.onPress();
    });

    expect(useConnectionStore.getState().offline).toBe(true);
    expect(useConnectionStore.getState().reconnecting).toBe(false);
  });
});
