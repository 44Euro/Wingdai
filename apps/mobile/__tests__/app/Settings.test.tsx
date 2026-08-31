import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SettingsScreen } from '../../src/features/customer/screens/SettingsScreen';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeProvider';
import { initI18n, i18n } from '../../src/i18n';

beforeAll(async () => {
  await initI18n();
});
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('th');
  });
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  act(() => r?.unmount());
  r = null;
});

function find(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id)[0];
}

// สถานะ "เลือกอยู่" ที่ตัวช่วยการเข้าถึงอ่านได้ อยู่บน Pressable ข้างใน ไม่ใช่บน ChoiceCard ชั้นนอก
function findPressable(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findAll((n) => n.props?.testID === id && n.props?.accessibilityState)[0];
}

/** อ่านธีมที่ใช้อยู่จริงออกมาจาก context เพื่อไม่ต้องเดาจากสีบนจอ */
let seenScheme: string | null = null;
function SchemeProbe() {
  seenScheme = useTheme().scheme;
  return null;
}

function render() {
  act(() => {
    r = ReactTestRenderer.create(
      <ThemeProvider>
        <SchemeProbe />
        <SettingsScreen navigation={{ goBack: jest.fn() } as never} route={{ key: 'k', name: 'Settings' } as never} />
      </ThemeProvider>,
    );
  });
  return r!;
}

describe('SettingsScreen (design C12 · SY5)', () => {
  it('มีตัวเลือกครบทั้งสองภาษาและสองธีม', () => {
    const result = render();
    for (const id of ['opt-lang-th', 'opt-lang-en', 'opt-theme-light', 'opt-theme-dark']) {
      expect(find(result.root, id)).toBeTruthy();
    }
  });

  it('ตัวเลือกที่ใช้อยู่ถูกทำเครื่องหมายว่าเลือกอยู่ ไม่ใช่ปล่อยว่างทั้งแถว', () => {
    const result = render();
    expect(findPressable(result.root, 'opt-lang-th').props.accessibilityState.selected).toBe(true);
    expect(findPressable(result.root, 'opt-lang-en').props.accessibilityState.selected).toBe(false);
  });

  it('กด English แล้วภาษาเปลี่ยนจริง ไม่ใช่แค่ไฮไลต์ปุ่ม', async () => {
    const result = render();
    await act(async () => {
      find(result.root, 'opt-lang-en').props.onPress();
    });
    expect(i18n.language).toBe('en');
  });

  it('กดโหมดมืดแล้วธีมที่ทั้งแอปใช้เปลี่ยนตาม', async () => {
    const result = render();
    await act(async () => {
      find(result.root, 'opt-theme-dark').props.onPress();
    });
    expect(seenScheme).toBe('dark');
  });

  it('ชื่อภาษาเขียนด้วยภาษาของมันเอง คนที่เปิดแอปมาเจอภาษาที่อ่านไม่ออกต้องหาทางกลับได้', () => {
    const result = render();
    const labels = result.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children);
    expect(labels).toContain('ไทย');
    expect(labels).toContain('English');
  });
});
