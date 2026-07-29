import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ProfileScreen } from '../../src/features/customer/screens/ProfileScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';

beforeAll(async () => {
  await initI18n();
});
beforeEach(() => {
  useAuthStore.setState({ account: null, capabilities: [], activeCapability: null } as never);
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
async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((res) => setTimeout(res, 5));
    });
  }
}
function render(node: React.ReactElement) {
  act(() => {
    r = ReactTestRenderer.create(<ThemeProvider forceScheme="light">{node}</ThemeProvider>);
  });
  return r!;
}

describe('ProfileScreen', () => {
  it('แสดงชื่อ account และกดออกจากระบบ → account = null', async () => {
    useAuthStore.setState({
      account: { id: 'u-somchai', accountType: 'user', username: 'somchai', fullName: 'สมชาย ใจดี', phone: '0812345678', ownedRestaurantIds: [] },
      capabilities: ['customer'],
      activeCapability: 'customer',
    } as never);
    const result = render(
      <ProfileScreen navigation={{ navigate: jest.fn() } as never} route={{ key: 'k', name: 'Profile' } as never} />,
    );

    const hasName = result.root.findAll((n) => n.props?.children === 'สมชาย ใจดี').length > 0;
    expect(hasName).toBe(true);

    act(() => {
      findAll(result.root, 'btn-logout')[0].props.onPress();
    });
    await flush();
    expect(useAuthStore.getState().account).toBeNull();
  });
});
