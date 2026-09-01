import React from 'react';
import { create, act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { ConsentScreen } from '../../src/features/onboarding/ConsentScreen';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import th from '../../src/i18n/locales/th.json';

const goBack = jest.fn();

function mount() {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ThemeProvider>
        <NavigationContainer>
          <ConsentScreen navigation={{ goBack } as never} route={{} as never} />
        </NavigationContainer>
      </ThemeProvider>,
    );
  });
  return tree;
}

function host(tree: ReturnType<typeof create>, testID: string) {
  return tree.root.findAll((n) => n.props?.testID === testID && typeof n.type === 'string');
}

describe('A8 ข้อตกลงการใช้งาน', () => {
  it('บอกตั้งแต่ต้นจอว่าเป็นเอกสารตัวอย่างของเดโม', () => {
    expect(host(mount(), 'consent-demo-notice')).toHaveLength(1);
  });

  it('มีหัวข้อครบตามที่ PDPA กำหนดให้ต้องแจ้ง', () => {
    const tree = mount();
    for (const key of ['collect', 'purpose', 'retain', 'share', 'rights', 'contact']) {
      expect(host(tree, `consent-section-${key}`)).toHaveLength(1);
    }
  });

  it('ออกจากจอได้ ไม่ใช่ทางตัน', () => {
    const tree = mount();
    const [back] = tree.root.findAll(
      (n) => n.props?.testID === 'btn-back' && typeof n.props?.onPress === 'function',
    );
    act(() => back!.props.onPress());
    expect(goBack).toHaveBeenCalled();
  });

  it('ข้อความไทยกับอังกฤษมีคีย์เท่ากัน', () => {
    const en = require('../../src/i18n/locales/en.json');
    expect(Object.keys(th.consent.section)).toEqual(Object.keys(en.consent.section));
  });
});
