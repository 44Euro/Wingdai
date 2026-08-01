import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import i18n from 'i18next';
import { RiderOnboardingStack } from '../../src/app/navigators/RiderOnboardingStack';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/features/auth/authStore';
import { repos } from '../../src/data';
import { MOCK_OTP, MOCK_VERIFICATION_TOKEN } from '../../src/data/mock';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('th');
});

beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [], activeCapability: null,
  } as never);
});

let r: ReactTestRenderer.ReactTestRenderer | null = null;
/**
 * จอรออนุมัติดึงสถานะซ้ำทุก 20 วินาทีตอนสถานะเป็น pending (ของจริงต้องเป็นแบบนั้น
 * เพื่อให้จอเปลี่ยนเองเมื่อแอดมินกดอนุมัติ) — ตัวจับเวลานั้นค้างข้ามเทสต์ถ้าไม่ล้าง
 * แล้วชุดเทสต์จะไม่จบ ต้องเก็บ client ไว้ล้างเองทุกครั้ง
 */
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
/**
 * กด element ที่มี testID นี้
 *
 * Checkbox ส่ง testID ต่อลงไปที่ Pressable ข้างใน จึงมี node ที่ testID ตรงกันสองชั้น:
 * ตัว Checkbox เอง (มี onChange) กับ Pressable (มี onPress) — เลือกตัวที่กดได้จริง
 */
function press(root: ReactTestRenderer.ReactTestInstance, id: string) {
  const node = root
    .findAll((n) => n.props?.testID === id)
    .find((n) => typeof n.props?.onPress === 'function');
  if (!node) throw new Error(`ไม่พบปุ่มที่กดได้: ${id}`);
  node.props.onPress();
}

function textOf(root: ReactTestRenderer.ReactTestInstance, id: string): string {
  return findAll(root, id)
    .flatMap((n) => n.findAll((c) => typeof c.type === 'string' && typeof c.props?.children === 'string'))
    .map((n) => String(n.props.children))
    .join(' ');
}
async function flush() {
  for (let i = 0; i < 14; i += 1) {
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
  // เทสต์สุดท้าย render สองรอบ (ก่อน/หลังแอดมินตัดสิน) — ถ้าไม่ปิดรอบเก่าก่อน
  // observer ของรอบนั้นจะยัง poll ทุก 20 วิ ค้างไว้ จนชุดเทสต์ไม่จบ
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
            <RiderOnboardingStack />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return r!;
}

/** สมัครบัญชีไรเดอร์ใหม่ — ผ่าน OTP เหมือนของจริง (claude.md §4.2) */
async function registerRider(username = 'rider_new', phone = '0891112222') {
  await act(async () => {
    await repos.auth.requestOtp(phone);
    const token = await repos.auth.verifyOtp(phone, MOCK_OTP);
    expect(token).toBe(MOCK_VERIFICATION_TOKEN);
    await useAuthStore.getState().register({
      username, password: 'wingdai1234', fullName: 'สมชาย ใจดี',
      phone, accountType: 'rider', verificationToken: token,
    });
  });
}

/** เลขบัตรที่ checksum ถูกต้อง — เลขมั่วจะโดนปฏิเสธ */
function validNationalId(): string {
  const first12 = '110170063579';
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(first12[i]) * (13 - i);
  return first12 + String((11 - (sum % 11)) % 10);
}

/**
 * เลข 13 หลักที่ **นับหลักผ่านแต่ checksum ผิด** — สร้างจากเลขที่ถูกต้องแล้วบิดหลักสุดท้าย
 * เขียนเลขมั่วขึ้นมาเองไม่ได้ เพราะมีโอกาส 1 ใน 10 ที่มันจะบังเอิญถูก
 * (เช่น 1111111111119 ซึ่ง checksum ถูกจริง)
 */
function invalidNationalId(): string {
  const valid = validNationalId();
  return valid.slice(0, 12) + String((Number(valid[12]) + 1) % 10);
}

function fillValidForm(result: ReactTestRenderer.ReactTestRenderer) {
  act(() => {
    findAny(result.root, 'input-national-id')[0].props.onChangeText(validNationalId());
    findAny(result.root, 'input-dob')[0].props.onChangeText('2000-01-31');
    findAny(result.root, 'input-vehicle-reg')[0].props.onChangeText('1กข 1234');
    findAny(result.root, 'input-licence-expiry')[0].props.onChangeText('2030-12-31');
    findAny(result.root, 'input-insurance-expiry')[0].props.onChangeText('2030-06-30');
    findAny(result.root, 'input-bank-name')[0].props.onChangeText('กสิกรไทย');
    findAny(result.root, 'input-bank-number')[0].props.onChangeText('1234567890');
    findAny(result.root, 'input-bank-holder')[0].props.onChangeText('สมชาย ใจดี');
    findAny(result.root, 'input-emergency-name')[0].props.onChangeText('สมหญิง ใจดี');
    findAny(result.root, 'input-emergency-phone')[0].props.onChangeText('0898887777');
    press(result.root, 'check-contract');
    press(result.root, 'check-pdpa');
  });
}

async function openApplicationForm(result: ReactTestRenderer.ReactTestRenderer) {
  await act(async () => {
    press(result.root, 'btn-open-application');
  });
  await flush();
}

describe('เส้นทางสมัครไรเดอร์ (R5)', () => {
  /**
   * ก่อนหน้านี้บัญชี rider ที่เพิ่งสมัครเจอ "รอการอนุมัติ" อย่างเดียว โดยไม่มีทางส่งใบสมัคร
   * แอดมินจึงไม่มีอะไรให้ตรวจ และการอนุมัติไม่มีวันเกิดขึ้น — จอนี้ต้องชวนให้กรอก ไม่ใช่ชวนให้รอ
   */
  it('เพิ่งสมัครบัญชี → จอบอกให้ส่งใบสมัคร ไม่ใช่ให้นั่งรอ', async () => {
    await registerRider('rider_a', '0891110001');
    const result = render();
    await flush();

    expect(findAll(result.root, 'screen-pending').length).toBe(1);
    expect(textOf(result.root, 'pending-title')).toBe(i18n.t('auth.pending.applyTitle'));
    expect(findAny(result.root, 'btn-open-application').length).toBeGreaterThan(0);
  });

  it('กรอกครบแล้วส่งได้ และสถานะกลายเป็นรอตรวจ', async () => {
    await registerRider('rider_b', '0891110002');
    const result = render();
    await flush();

    await openApplicationForm(result);
    expect(findAll(result.root, 'screen-rider-apply').length).toBe(1);

    fillValidForm(result);
    await act(async () => {
      press(result.root, 'btn-submit-application');
    });
    await flush();

    expect(findAll(result.root, 'application-sent').length).toBe(1);
    expect((await repos.rider.application()).status).toBe('pending');
  });

  /** เลข 13 หลักที่ checksum ผิดต้องไม่ผ่าน — ไม่ใช่แค่นับหลัก */
  it('เลขบัตรประชาชนมั่วส่งไม่ผ่าน', async () => {
    await registerRider('rider_c', '0891110003');
    const result = render();
    await flush();
    await openApplicationForm(result);

    fillValidForm(result);
    act(() => {
      findAny(result.root, 'input-national-id')[0].props.onChangeText(invalidNationalId());
    });
    await act(async () => {
      press(result.root, 'btn-submit-application');
    });
    await flush();

    expect(findAll(result.root, 'apply-incomplete').length).toBe(1);
    expect(findAll(result.root, 'application-sent').length).toBe(0);
    expect((await repos.rider.application()).status).toBe('none');
  });

  /** §7 ไม่ติ๊กสัญญา/PDPA = ส่งไม่ได้ — ตรวจซ้ำที่ repo ด้วย ไม่ใช่แค่ปิดปุ่ม */
  it('ไม่ยอมรับสัญญาหรือ PDPA ส่งไม่ได้', async () => {
    await registerRider('rider_d', '0891110004');
    const result = render();
    await flush();
    await openApplicationForm(result);

    fillValidForm(result);
    act(() => {
      press(result.root, 'check-pdpa'); // ติ๊กออก
    });
    await act(async () => {
      press(result.root, 'btn-submit-application');
    });
    await flush();

    expect(findAll(result.root, 'apply-incomplete').length).toBe(1);
    expect((await repos.rider.application()).status).toBe('none');
  });

  /** เอกสารหมดอายุต้องถูกบอกตอนส่ง ไม่ใช่ปล่อยผ่านแล้วเงียบ ๆ ไม่จ่ายงานให้ทีหลัง */
  it('ใบขับขี่หมดอายุส่งไม่ผ่าน', async () => {
    await registerRider('rider_e', '0891110005');
    const result = render();
    await flush();
    await openApplicationForm(result);

    fillValidForm(result);
    act(() => {
      findAny(result.root, 'input-licence-expiry')[0].props.onChangeText('2020-01-01');
    });
    await act(async () => {
      press(result.root, 'btn-submit-application');
    });
    await flush();

    expect((await repos.rider.application()).status).toBe('none');
  });

  /**
   * วงจรเต็ม: ไรเดอร์ส่ง → แอดมินเห็นในคิว → ปฏิเสธพร้อมเหตุผล → ไรเดอร์เห็นเหตุผลและส่งใหม่ได้
   * นี่คือสิ่งที่ทำให้บัญชี rider ไม่เป็นทางตันอีกต่อไป
   */
  it('แอดมินปฏิเสธพร้อมเหตุผล → ไรเดอร์เห็นเหตุผลและส่งใหม่ได้', async () => {
    await registerRider('rider_f', '0891110006');
    const result = render();
    await flush();
    await openApplicationForm(result);
    fillValidForm(result);
    await act(async () => {
      press(result.root, 'btn-submit-application');
    });
    await flush();

    // แอดมินเห็นใบนี้ในคิวจริง
    await act(async () => {
      await useAuthStore.getState().login('admin', '1234');
    });
    // ทุกคนในเทสต์นี้ชื่อเดียวกัน — ต้องหาด้วยเบอร์ ซึ่งไม่ซ้ำกัน
    const queue = await repos.admin.pendingRiders();
    const mine = queue.find((x) => x.phone === '0891110006');
    expect(mine).toBeDefined();

    // ปฏิเสธโดยไม่บอกเหตุผลไม่ได้ — ไรเดอร์จะไม่รู้ว่าต้องแก้อะไร
    await expect(
      repos.admin.decideRider(mine!.accountId, { approve: false }),
    ).rejects.toThrow();

    await act(async () => {
      await repos.admin.decideRider(mine!.accountId, {
        approve: false, rejectionReason: 'ทะเบียนรถไม่ตรงกับเล่ม',
      });
    });

    // ไรเดอร์กลับมาเห็นเหตุผล และส่งใหม่ได้
    await act(async () => {
      await useAuthStore.getState().login('rider_f', '1234');
    });
    const after = render();
    await flush();
    expect(textOf(after.root, 'pending-title')).toBe(i18n.t('auth.pending.rejectedTitle'));
    expect(textOf(after.root, 'rejection-reason')).toContain('ทะเบียนรถไม่ตรงกับเล่ม');
    expect(findAny(after.root, 'btn-open-application').length).toBeGreaterThan(0);
  });
});
