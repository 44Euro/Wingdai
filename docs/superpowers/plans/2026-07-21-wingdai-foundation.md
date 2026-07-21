# Wingdai Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างรากฐานแอป Wingdai ให้เปิดได้จริงบนเครื่อง ล็อกอินเป็นแต่ละบทบาทแล้วเห็นคนละ stack สลับภาษาไทย/อังกฤษและโหมดสว่าง/มืดได้ และมี data layer ที่ทดสอบวงจรออร์เดอร์ได้ครบผ่านโค้ด

**ขอบเขตเทียบกับ spec:** ครอบคลุม **ช่วง 1 เต็ม** · **ช่วง 2 เฉพาะเส้นทางล็อกอิน** (Login, PendingApproval, capability routing, role switcher — ยังไม่มี Register/OTP/ChooseAccountType/ForgotPassword) · **ช่วง 3 เฉพาะ data layer แบบ request-response** (repositories, mock, order state machine — ยังไม่มี realtime event bus เพราะยังไม่มีหน้าจอที่ต้องใช้) รายละเอียดที่ยกไปแผนถัดไปอยู่ท้ายเอกสาร

**Architecture:** แอป React Native + Expo เดียว ไม่มี backend — ข้อมูลมาจาก MockRepo ที่ implement interface เดียวกับ HttpRepo ที่จะมาทีหลัง Navigation เลือก stack จาก capability set ที่คำนวณจากบัญชี ไม่ใช่จาก role enum แบน ๆ สีและระยะทั้งหมดมาจาก token สามชั้น (primitive → semantic → component) เพื่อให้โหมดมืดเกิดขึ้นที่ชั้นเดียว

**Tech Stack:** Expo (SDK ล่าสุด) · TypeScript · React Navigation 7 · Zustand · TanStack Query · i18next + expo-localization · Jest + @testing-library/react-native

## Global Constraints

ข้อกำหนดระดับโปรเจกต์ — ใช้กับทุก task โดยไม่ต้องเขียนซ้ำ

- **สีปุ่มและข้อความสีแบรนด์ต้องเป็น `#D23A01` (brand-700) เท่านั้น** — `#FE6227` (brand-500) ให้ contrast กับตัวหนังสือขาวแค่ 3.00:1 ไม่ผ่าน WCAG AA ห้ามใช้เป็นพื้นปุ่มที่มีตัวหนังสือ และห้ามใช้เป็นสีข้อความบนพื้นสว่างทุกขนาด
- **`allowFontScaling={false}`** ตั้งที่ `Text` component กลางเพียงที่เดียว ห้ามไล่ใส่รายจุด
- **`lineHeight` ขั้นต่ำ 1.7 เท่าของ `fontSize`** ทุกที่ — สระบนและวรรณยุกต์ไทยชนกันถ้าต่ำกว่านี้
- **ห้าม `letterSpacing` ติดลบ** ทุกกรณี
- **ห้ามมีสตริงภาษาไทยหรืออังกฤษฝังใน component** — ทุกข้อความผ่าน i18n key ที่ตั้งตามความหมาย (`auth.login.submit` ไม่ใช่ `เข้าสู่ระบบ`)
- **ห้าม component ใน `src/features/` หรือ `src/ui/` import อะไรจาก `src/data/mock/`** โดยตรง — เข้าถึงผ่าน repository interface เท่านั้น
- **ห้ามใช้ `BlurView`** บนหน้าคิวออร์เดอร์ร้าน หน้าข้อเสนองานไรเดอร์ และหน้าแผนที่ (ไม่มีหน้าเหล่านี้ในแผนนี้ แต่กฎมีผลตั้งแต่ตอนนี้)
- **`src/theme/tokens/` ห้าม import อะไรจากส่วนอื่นของแอป** — ต้องย้ายออกเป็น package แยกได้โดยไม่ต้องแก้โค้ด
- **ภาษาต้นทางคือไทย** — เขียน `th.json` ก่อนเสมอ แล้วจึงแปลเป็น `en.json`
- **`account_type` มีสามค่าเท่านั้น:** `user` · `rider` · `admin` — merchant และ customer เป็น capability ไม่ใช่ account type

---

## โครงสร้างไฟล์

```
/apps/mobile
  app.config.ts                     ตั้งชื่อแอป ไอคอน splash
  package.json · tsconfig.json · jest.config.js · jest.setup.ts
  /assets                           โลโก้ที่ประมวลผลแล้ว
  /src
    /theme
      /tokens
        primitives.ts               ค่าสีดิบ ระยะ ฟอนต์ — ไม่ import อะไรเลย
        semantic.light.ts           map primitive → บทบาท โหมดสว่าง
        semantic.dark.ts            map primitive → บทบาท โหมดมืด
        contrast.ts                 ฟังก์ชันคำนวณ WCAG contrast (ใช้ในเทสต์)
        index.ts                    export รวม + type SemanticTokens
      ThemeProvider.tsx             context + useTheme()
    /i18n
      /locales/th.json · en.json
      index.ts                      ตั้งค่า i18next + ตรวจ locale เครื่อง
    /ui
      Text.tsx                      บังคับ allowFontScaling + lineHeight
      Button.tsx                    บังคับสีที่ผ่าน contrast
      Money.tsx                     แสดงเงินตาม locale
    /lib
      capabilities.ts               คำนวณ capability set จากบัญชี
      rules.ts                      กฎ conflict-of-interest
    /data
      /types                        Account · Restaurant · Order · …
      /repositories                 interface ของทุก repo
      /mock                         MockRepo + seed + state machine
      /http                         HttpRepo stub (throw NotImplemented)
      /realtime                     event bus หน้าตาเหมือน WebSocket client
      index.ts                      จุดสลับ mock ↔ http จุดเดียว
    /features/auth/screens          Login · Register · OtpVerify · ChooseAccountType
                                    ForgotPassword · PendingApproval
    /app
      RootNavigator.tsx             เลือก stack จาก capability
      /navigators                   AuthStack · CustomerStack · MerchantStack
                                    RiderStack · AdminStack (โครงเปล่าในแผนนี้)
      RoleSwitcher.tsx
  /__tests__                        มิเรอร์โครง src
```

**เหตุผลที่ tokens อยู่ใน app ไม่ใช่ package แยก:** ตอนนี้มีผู้ใช้รายเดียว การตั้ง monorepo ให้ Metro resolver ทำงานยังไม่ให้ประโยชน์ กฎ "ห้าม import จากส่วนอื่น" รักษาความสามารถในการย้ายออกไว้แล้ว

---

### Task 1: Scaffold โปรเจกต์และ git

**Files:**
- Create: `.gitignore`, `apps/mobile/` (ทั้งโฟลเดอร์จาก template)
- Create: `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts`

**Interfaces:**
- Consumes: ไม่มี (task แรก)
- Produces: โปรเจกต์ Expo + TypeScript ที่รัน `npm test` ได้

- [ ] **Step 1: สร้าง git repo**

```bash
cd /Users/pannatron.r/Desktop/Food_rush_project
git init
git add claude.md docs/ Logo/
git commit -m "chore: initial commit — spec, plan, logo assets"
```

- [ ] **Step 2: สร้างแอป Expo**

```bash
cd /Users/pannatron.r/Desktop/Food_rush_project
npx create-expo-app@latest apps/mobile --template blank-typescript
```

- [ ] **Step 3: ติดตั้ง dependency**

```bash
cd apps/mobile
npx expo install expo-localization react-native-safe-area-context react-native-screens
npm install @react-navigation/native
npm install zustand @tanstack/react-query i18next react-i18next
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest
```

- [ ] **Step 4: ตั้งค่า Jest**

สร้าง `apps/mobile/jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|react-native-svg))',
  ],
};
```

สร้าง `apps/mobile/jest.setup.ts`:

```ts
import '@testing-library/react-native/extend-expect';
```

เพิ่มใน `apps/mobile/package.json` ส่วน `scripts`:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: เขียนเทสต์พิสูจน์ว่า setup ทำงาน**

สร้าง `apps/mobile/__tests__/setup.test.ts`:

```ts
describe('jest setup', () => {
  it('รันเทสต์ได้', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: รันเทสต์**

Run: `cd apps/mobile && npm test`
Expected: PASS — 1 test passed

- [ ] **Step 7: Commit**

```bash
cd /Users/pannatron.r/Desktop/Food_rush_project
git add -A
git commit -m "chore: scaffold Expo app with TypeScript and Jest"
```

---

### Task 2: Primitive tokens + ตัวคำนวณ contrast

**Files:**
- Create: `apps/mobile/src/theme/tokens/primitives.ts`
- Create: `apps/mobile/src/theme/tokens/contrast.ts`
- Test: `apps/mobile/__tests__/theme/contrast.test.ts`

**Interfaces:**
- Consumes: ไม่มี
- Produces:
  - `primitives` object พร้อมคีย์ `brand[400|500|600|700|800|900]`, `teal900`, `cream`, `white`, `space`, `radius`, `fontSize`, `lineHeight`
  - `contrastRatio(hexA: string, hexB: string): number`
  - `relativeLuminance(hex: string): number`

- [ ] **Step 1: เขียนเทสต์ contrast ที่ต้องล้มก่อน**

สร้าง `apps/mobile/__tests__/theme/contrast.test.ts`:

```ts
import { contrastRatio } from '../../src/theme/tokens/contrast';
import { primitives } from '../../src/theme/tokens/primitives';

describe('contrastRatio', () => {
  it('สีเดียวกันได้อัตรา 1:1', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('ขาวกับดำได้ 21:1', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('รับค่าที่ไม่มี # นำหน้าได้', () => {
    expect(contrastRatio('FFFFFF', '000000')).toBeCloseTo(21, 1);
  });
});

describe('กฎสีของแบรนด์ Wingdai', () => {
  const { brand, teal900, cream, white } = primitives;

  it('teal บนครีมผ่าน AA สำหรับข้อความปกติ', () => {
    expect(contrastRatio(teal900, cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('ครีมบน teal ผ่าน AA (โหมดมืด)', () => {
    expect(contrastRatio(cream, teal900)).toBeGreaterThanOrEqual(4.5);
  });

  it('ขาวบน brand-700 ผ่าน AA — นี่คือสีปุ่มที่ใช้ได้', () => {
    expect(contrastRatio(white, brand[700])).toBeGreaterThanOrEqual(4.5);
  });

  it('brand-700 บนครีมผ่าน AA — สีข้อความแบรนด์', () => {
    expect(contrastRatio(brand[700], cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('ขาวบน brand-500 ไม่ผ่าน AA — กันคนเผลอเอาไปทำปุ่ม', () => {
    expect(contrastRatio(white, brand[500])).toBeLessThan(4.5);
  });

  it('brand-500 บนครีมไม่ผ่าน AA — กันคนเผลอเอาไปทำข้อความ', () => {
    expect(contrastRatio(brand[500], cream)).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- contrast`
Expected: FAIL — "Cannot find module '../../src/theme/tokens/contrast'"

- [ ] **Step 3: เขียน contrast.ts**

สร้าง `apps/mobile/src/theme/tokens/contrast.ts`:

```ts
function toChannels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function relativeLuminance(hex: string): number {
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const [r, g, b] = toChannels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step 4: เขียน primitives.ts**

สร้าง `apps/mobile/src/theme/tokens/primitives.ts`:

```ts
/**
 * ค่าดิบของแบรนด์ Wingdai — สกัดจาก Logo/logo.png ด้วยการอ่านพิกเซลจริง
 * ไฟล์นี้ห้าม import อะไรจากส่วนอื่นของแอป
 */
export const primitives = {
  brand: {
    400: '#FE7B4A',
    500: '#FE6227', // สีโลโก้ — ใช้กับกราฟิกเท่านั้น ห้ามใส่ตัวหนังสือทับ
    600: '#FB4601',
    700: '#D23A01', // สีปุ่มและข้อความ — ผ่าน AA
    800: '#A92F01',
    900: '#802401',
  },
  teal900: '#023839', // ตัวอักษรในโลโก้ / ข้อความ light / พื้นหลัง dark
  cream: '#FEFBF7',   // พื้นหลัง light / ข้อความ dark
  white: '#FFFFFF',
  neutral: {
    100: '#E8E1DA',
    300: '#B5ABA3',
    500: '#6B615A',
    700: '#3D3630',
  },
  danger: '#B42318',
  success: '#2C5435',

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 8, md: 12, lg: 20, xl: 28, full: 9999 },

  fontFamily: {
    heading: 'Prompt_600SemiBold',
    body: 'IBMPlexSansThai_400Regular',
    bodyBold: 'IBMPlexSansThai_600SemiBold',
  },

  /** lineHeight ทุกค่าต้อง >= fontSize * 1.7 เพราะสระไทยชนกันถ้าต่ำกว่านี้ */
  fontSize: { caption: 13, small: 14, body: 16, bodyLg: 18, h3: 20, h2: 24, h1: 28, display: 32 },
  lineHeight: { caption: 22, small: 24, body: 28, bodyLg: 31, h3: 34, h2: 41, h1: 48, display: 54 },
} as const;

export type Primitives = typeof primitives;
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `cd apps/mobile && npm test -- contrast`
Expected: PASS — 9 tests passed

- [ ] **Step 6: เขียนเทสต์ว่า lineHeight ทุกค่าผ่านกฎ 1.7**

เพิ่มใน `apps/mobile/__tests__/theme/contrast.test.ts`:

```ts
describe('กฎ lineHeight ภาษาไทย', () => {
  it('lineHeight ทุกระดับต้องไม่ต่ำกว่า 1.7 เท่าของ fontSize', () => {
    const { fontSize, lineHeight } = primitives;
    (Object.keys(fontSize) as Array<keyof typeof fontSize>).forEach((key) => {
      const ratio = lineHeight[key] / fontSize[key];
      expect(ratio).toBeGreaterThanOrEqual(1.7);
    });
  });
});
```

- [ ] **Step 7: รันเทสต์**

Run: `cd apps/mobile && npm test -- contrast`
Expected: PASS — 10 tests passed

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/theme apps/mobile/__tests__/theme
git commit -m "feat: add Wingdai primitive tokens with enforced contrast and Thai line-height rules"
```

---

### Task 3: Semantic tokens + ThemeProvider

**Files:**
- Create: `apps/mobile/src/theme/tokens/semantic.light.ts`
- Create: `apps/mobile/src/theme/tokens/semantic.dark.ts`
- Create: `apps/mobile/src/theme/tokens/index.ts`
- Create: `apps/mobile/src/theme/ThemeProvider.tsx`
- Test: `apps/mobile/__tests__/theme/semantic.test.ts`

**Interfaces:**
- Consumes: `primitives`, `contrastRatio` จาก Task 2
- Produces:
  - `type SemanticTokens` — คีย์: `bgSurface`, `bgRaised`, `textPrimary`, `textMuted`, `textOnBrand`, `borderSubtle`, `brandSolid`, `brandAccent`, `danger`, `success`
  - `semanticLight`, `semanticDark` (ทั้งคู่เป็น `SemanticTokens`)
  - `ThemeProvider` component และ `useTheme(): { tokens: SemanticTokens; scheme: 'light'|'dark'; primitives: Primitives }`

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/theme/semantic.test.ts`:

```ts
import { semanticLight, semanticDark } from '../../src/theme/tokens';
import { contrastRatio } from '../../src/theme/tokens/contrast';

const modes = [
  ['light', semanticLight],
  ['dark', semanticDark],
] as const;

describe('semantic tokens', () => {
  it('ทั้งสองโหมดมีคีย์ชุดเดียวกันครบ', () => {
    expect(Object.keys(semanticLight).sort()).toEqual(Object.keys(semanticDark).sort());
  });

  modes.forEach(([name, t]) => {
    describe(`โหมด ${name}`, () => {
      it('ข้อความหลักบนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.textPrimary, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความรองบนพื้นผ่าน AA', () => {
        expect(contrastRatio(t.textMuted, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความบนปุ่มแบรนด์ผ่าน AA', () => {
        expect(contrastRatio(t.textOnBrand, t.brandSolid)).toBeGreaterThanOrEqual(4.5);
      });

      it('ข้อความหลักบนพื้นยกระดับผ่าน AA', () => {
        expect(contrastRatio(t.textPrimary, t.bgRaised)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- semantic`
Expected: FAIL — "Cannot find module '../../src/theme/tokens'"

- [ ] **Step 3: เขียน semantic.light.ts**

สร้าง `apps/mobile/src/theme/tokens/semantic.light.ts`:

```ts
import { primitives as p } from './primitives';

export const semanticLight = {
  bgSurface: p.cream,
  bgRaised: p.white,
  textPrimary: p.teal900,
  textMuted: p.neutral[700],
  textOnBrand: p.white,
  borderSubtle: p.neutral[100],
  brandSolid: p.brand[700],  // ปุ่ม — ผ่าน AA กับตัวหนังสือขาว
  brandAccent: p.brand[500], // กราฟิกเท่านั้น ห้ามใส่ตัวหนังสือทับ
  danger: p.danger,
  success: p.success,
} as const;
```

- [ ] **Step 4: เขียน semantic.dark.ts**

สร้าง `apps/mobile/src/theme/tokens/semantic.dark.ts`:

```ts
import { primitives as p } from './primitives';

/**
 * โหมดมืดใช้ teal ของแบรนด์เป็นพื้นหลัง ไม่ใช่เทาดำกลาง ๆ
 * เพื่อให้โหมดมืดยังเป็น Wingdai
 */
export const semanticDark = {
  bgSurface: p.teal900,
  bgRaised: '#0A4A4B',
  textPrimary: p.cream,
  textMuted: '#B8C9C9',
  textOnBrand: p.white,
  borderSubtle: '#0F5354',
  brandSolid: p.brand[700],
  brandAccent: p.brand[500],
  danger: '#F97066',
  success: '#75C48B',
} as const;
```

- [ ] **Step 5: เขียน index.ts**

สร้าง `apps/mobile/src/theme/tokens/index.ts`:

```ts
export { primitives } from './primitives';
export type { Primitives } from './primitives';
export { contrastRatio, relativeLuminance } from './contrast';
export { semanticLight } from './semantic.light';
export { semanticDark } from './semantic.dark';

import { semanticLight } from './semantic.light';
export type SemanticTokens = typeof semanticLight;
```

- [ ] **Step 6: รันเทสต์**

Run: `cd apps/mobile && npm test -- semantic`
Expected: PASS — 9 tests passed

หากข้อใดล้ม ให้ปรับค่าสีใน semantic ไฟล์ที่ล้ม จนผ่าน — ห้ามลดเกณฑ์ในเทสต์

- [ ] **Step 7: เขียน ThemeProvider**

สร้าง `apps/mobile/src/theme/ThemeProvider.tsx`:

```tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { primitives, semanticLight, semanticDark } from './tokens';
import type { SemanticTokens, Primitives } from './tokens';

type Scheme = 'light' | 'dark';

type ThemeValue = {
  tokens: SemanticTokens;
  primitives: Primitives;
  scheme: Scheme;
  setScheme: (s: Scheme) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  children,
  forceScheme,
}: {
  children: React.ReactNode;
  forceScheme?: Scheme;
}) {
  const system = useColorScheme();
  const [override, setOverride] = useState<Scheme | null>(forceScheme ?? null);
  const scheme: Scheme = override ?? (system === 'dark' ? 'dark' : 'light');

  const value = useMemo<ThemeValue>(
    () => ({
      tokens: scheme === 'dark' ? semanticDark : semanticLight,
      primitives,
      scheme,
      setScheme: setOverride,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme ต้องอยู่ภายใน ThemeProvider');
  return ctx;
}
```

- [ ] **Step 8: เขียนเทสต์ ThemeProvider**

สร้าง `apps/mobile/__tests__/theme/ThemeProvider.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeProvider';

function Probe() {
  const { tokens, scheme } = useTheme();
  return <Text testID="probe">{`${scheme}:${tokens.bgSurface}`}</Text>;
}

describe('ThemeProvider', () => {
  it('โหมดสว่างให้พื้นสีครีม', () => {
    render(
      <ThemeProvider forceScheme="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('light:#FEFBF7');
  });

  it('โหมดมืดให้พื้นสี teal', () => {
    render(
      <ThemeProvider forceScheme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('dark:#023839');
  });

  it('useTheme นอก Provider ต้อง throw', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useTheme ต้องอยู่ภายใน ThemeProvider');
    spy.mockRestore();
  });
});
```

- [ ] **Step 9: รันเทสต์ทั้งหมด**

Run: `cd apps/mobile && npm test`
Expected: PASS — ทุกเทสต์ผ่าน

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/theme apps/mobile/__tests__/theme
git commit -m "feat: add semantic token layer and ThemeProvider with dark mode"
```

---

### Task 4: i18n ไทย/อังกฤษ

**Files:**
- Create: `apps/mobile/src/i18n/locales/th.json`
- Create: `apps/mobile/src/i18n/locales/en.json`
- Create: `apps/mobile/src/i18n/index.ts`
- Test: `apps/mobile/__tests__/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: ไม่มี
- Produces:
  - `initI18n(): Promise<void>`
  - `i18n` instance (จาก i18next) — ใช้ `i18n.t(key)` และ `i18n.changeLanguage(lng)`
  - `detectDeviceLanguage(): 'th' | 'en'`

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/i18n/i18n.test.ts`:

```ts
import th from '../../src/i18n/locales/th.json';
import en from '../../src/i18n/locales/en.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? flatten(v as Record<string, unknown>, key)
      : [key];
  });
}

describe('ไฟล์แปลภาษา', () => {
  const thKeys = flatten(th).sort();
  const enKeys = flatten(en).sort();

  it('ไทยและอังกฤษมี key ครบเท่ากัน', () => {
    expect(thKeys).toEqual(enKeys);
  });

  it('ไม่มีค่าว่างในไฟล์ไทย', () => {
    flatten(th).forEach((key) => {
      const value = key.split('.').reduce<any>((o, k) => o[k], th);
      expect(String(value).trim().length).toBeGreaterThan(0);
    });
  });

  it('ไม่มีค่าว่างในไฟล์อังกฤษ', () => {
    flatten(en).forEach((key) => {
      const value = key.split('.').reduce<any>((o, k) => o[k], en);
      expect(String(value).trim().length).toBeGreaterThan(0);
    });
  });

  it('ไฟล์อังกฤษต้องไม่มีอักษรไทยหลงเหลือ', () => {
    flatten(en).forEach((key) => {
      const value = String(key.split('.').reduce<any>((o, k) => o[k], en));
      expect(value).not.toMatch(/[฀-๿]/);
    });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- i18n`
Expected: FAIL — "Cannot find module '../../src/i18n/locales/th.json'"

- [ ] **Step 3: เขียนไฟล์ภาษาไทย (ภาษาต้นทาง)**

สร้าง `apps/mobile/src/i18n/locales/th.json`:

```json
{
  "common": {
    "appName": "Wingdai",
    "continue": "ต่อไป",
    "cancel": "ยกเลิก",
    "back": "ย้อนกลับ",
    "save": "บันทึก",
    "loading": "กำลังโหลด",
    "errorGeneric": "เกิดข้อผิดพลาด กรุณาลองใหม่"
  },
  "auth": {
    "login": {
      "title": "เข้าสู่ระบบ",
      "username": "ชื่อผู้ใช้",
      "password": "รหัสผ่าน",
      "submit": "เข้าสู่ระบบ",
      "forgot": "ลืมรหัสผ่าน",
      "toRegister": "ยังไม่มีบัญชี สมัครเลย",
      "invalidCredentials": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
    },
    "register": {
      "title": "สมัครสมาชิก",
      "fullName": "ชื่อ-นามสกุล",
      "phone": "เบอร์โทรศัพท์",
      "phoneInvalid": "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง",
      "submit": "สมัครสมาชิก"
    },
    "otp": {
      "title": "ยืนยันเบอร์โทรศัพท์",
      "description": "เราส่งรหัส 6 หลักไปที่เบอร์ของคุณแล้ว",
      "resend": "ส่งรหัสอีกครั้ง",
      "invalid": "รหัสไม่ถูกต้อง"
    },
    "chooseType": {
      "title": "คุณจะใช้ Wingdai แบบไหน",
      "user": "สั่งอาหาร",
      "userDescription": "สั่งอาหารจากร้านใกล้คุณในราคาเท่าหน้าร้าน",
      "rider": "เป็นไรเดอร์",
      "riderDescription": "รับงานส่งอาหารในโซนใกล้บ้าน"
    },
    "forgot": {
      "title": "ลืมรหัสผ่าน",
      "description": "กรอกเบอร์โทรศัพท์ที่ใช้สมัคร เราจะส่งรหัสไปให้",
      "submit": "ส่งรหัส"
    },
    "pending": {
      "title": "รอการอนุมัติ",
      "description": "เรากำลังตรวจสอบเอกสารของคุณ จะแจ้งผลภายใน 1-2 วันทำการ",
      "logout": "ออกจากระบบ"
    }
  },
  "roleSwitcher": {
    "title": "สลับโหมด",
    "customer": "โหมดลูกค้า",
    "merchant": "โหมดร้านค้า",
    "rider": "โหมดไรเดอร์",
    "admin": "โหมดผู้ดูแล"
  },
  "settings": {
    "language": "ภาษา",
    "theme": "ธีม",
    "themeLight": "สว่าง",
    "themeDark": "มืด"
  }
}
```

- [ ] **Step 4: เขียนไฟล์ภาษาอังกฤษ**

สร้าง `apps/mobile/src/i18n/locales/en.json`:

```json
{
  "common": {
    "appName": "Wingdai",
    "continue": "Continue",
    "cancel": "Cancel",
    "back": "Back",
    "save": "Save",
    "loading": "Loading",
    "errorGeneric": "Something went wrong. Please try again."
  },
  "auth": {
    "login": {
      "title": "Log in",
      "username": "Username",
      "password": "Password",
      "submit": "Log in",
      "forgot": "Forgot password",
      "toRegister": "No account yet? Sign up",
      "invalidCredentials": "Incorrect username or password"
    },
    "register": {
      "title": "Sign up",
      "fullName": "Full name",
      "phone": "Phone number",
      "phoneInvalid": "Please enter a valid phone number",
      "submit": "Sign up"
    },
    "otp": {
      "title": "Verify your phone",
      "description": "We sent a 6-digit code to your number",
      "resend": "Send code again",
      "invalid": "Incorrect code"
    },
    "chooseType": {
      "title": "How will you use Wingdai?",
      "user": "Order food",
      "userDescription": "Order from nearby restaurants at in-store prices",
      "rider": "Become a rider",
      "riderDescription": "Take delivery jobs in your neighbourhood"
    },
    "forgot": {
      "title": "Forgot password",
      "description": "Enter the phone number you signed up with and we'll send you a code",
      "submit": "Send code"
    },
    "pending": {
      "title": "Awaiting approval",
      "description": "We're reviewing your documents. You'll hear from us within 1-2 business days.",
      "logout": "Log out"
    }
  },
  "roleSwitcher": {
    "title": "Switch mode",
    "customer": "Customer mode",
    "merchant": "Merchant mode",
    "rider": "Rider mode",
    "admin": "Admin mode"
  },
  "settings": {
    "language": "Language",
    "theme": "Theme",
    "themeLight": "Light",
    "themeDark": "Dark"
  }
}
```

- [ ] **Step 5: รันเทสต์**

Run: `cd apps/mobile && npm test -- i18n`
Expected: PASS — 4 tests passed

- [ ] **Step 6: เขียนตัวตั้งค่า i18n**

สร้าง `apps/mobile/src/i18n/index.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import th from './locales/th.json';
import en from './locales/en.json';

export type AppLanguage = 'th' | 'en';

export function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'th' ? 'th' : 'en';
}

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: { th: { translation: th }, en: { translation: en } },
    lng: detectDeviceLanguage(),
    fallbackLng: 'th',
    interpolation: { escapeValue: false },
  });
}

export { i18n };
```

- [ ] **Step 7: เขียนเทสต์ว่าแปลได้จริงทั้งสองภาษา**

สร้าง `apps/mobile/__tests__/i18n/translate.test.ts`:

```ts
import { initI18n, i18n } from '../../src/i18n';

describe('การแปล', () => {
  beforeAll(async () => {
    await initI18n();
  });

  it('แปลภาษาไทยได้', async () => {
    await i18n.changeLanguage('th');
    expect(i18n.t('auth.login.title')).toBe('เข้าสู่ระบบ');
  });

  it('แปลภาษาอังกฤษได้', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('auth.login.title')).toBe('Log in');
  });

  it('ชื่อแบรนด์ไม่ถูกแปล', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('common.appName')).toBe('Wingdai');
    await i18n.changeLanguage('th');
    expect(i18n.t('common.appName')).toBe('Wingdai');
  });
});
```

- [ ] **Step 8: รันเทสต์**

Run: `cd apps/mobile && npm test -- i18n`
Expected: PASS — 7 tests passed

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/i18n apps/mobile/__tests__/i18n
git commit -m "feat: add Thai/English i18n with key-parity tests"
```

---

### Task 5: UI Text component

**Files:**
- Create: `apps/mobile/src/ui/Text.tsx`
- Test: `apps/mobile/__tests__/ui/Text.test.tsx`

**Interfaces:**
- Consumes: `useTheme()` จาก Task 3
- Produces: `<Text variant? color? style? >` — `variant: 'display'|'h1'|'h2'|'h3'|'bodyLg'|'body'|'small'|'caption'` (ค่าเริ่มต้น `body`), `color: 'primary'|'muted'|'onBrand'|'brand'` (ค่าเริ่มต้น `primary`)

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/ui/Text.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from '../../src/ui/Text';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(<ThemeProvider forceScheme={scheme}>{ui}</ThemeProvider>);

function flatStyle(el: any) {
  const s = el.props.style;
  return Array.isArray(s) ? Object.assign({}, ...s.flat().filter(Boolean)) : s;
}

describe('Text', () => {
  it('ปิด font scaling เสมอ', () => {
    wrap(<Text testID="t">สวัสดี</Text>);
    expect(screen.getByTestId('t').props.allowFontScaling).toBe(false);
  });

  it('lineHeight ไม่ต่ำกว่า 1.7 เท่าของ fontSize ทุก variant', () => {
    const variants = ['display', 'h1', 'h2', 'h3', 'bodyLg', 'body', 'small', 'caption'] as const;
    variants.forEach((v) => {
      const { unmount } = wrap(<Text testID={`t-${v}`} variant={v}>ก</Text>);
      const style = flatStyle(screen.getByTestId(`t-${v}`));
      expect(style.lineHeight / style.fontSize).toBeGreaterThanOrEqual(1.7);
      unmount();
    });
  });

  it('ไม่มี letterSpacing ติดลบ', () => {
    wrap(<Text testID="t">ก</Text>);
    const style = flatStyle(screen.getByTestId('t'));
    if (style.letterSpacing !== undefined) {
      expect(style.letterSpacing).toBeGreaterThanOrEqual(0);
    }
  });

  it('สีข้อความเปลี่ยนตามโหมด', () => {
    const { unmount } = wrap(<Text testID="t">ก</Text>, 'light');
    expect(flatStyle(screen.getByTestId('t')).color).toBe('#023839');
    unmount();
    wrap(<Text testID="t2">ก</Text>, 'dark');
    expect(flatStyle(screen.getByTestId('t2')).color).toBe('#FEFBF7');
  });

  it('color="brand" ใช้ brand-700 ไม่ใช่ brand-500', () => {
    wrap(<Text testID="t" color="brand">ก</Text>);
    expect(flatStyle(screen.getByTestId('t')).color).toBe('#D23A01');
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- Text`
Expected: FAIL — "Cannot find module '../../src/ui/Text'"

- [ ] **Step 3: เขียน Text component**

สร้าง `apps/mobile/src/ui/Text.tsx`:

```tsx
import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type TextVariant =
  | 'display' | 'h1' | 'h2' | 'h3'
  | 'bodyLg' | 'body' | 'small' | 'caption';

export type TextColor = 'primary' | 'muted' | 'onBrand' | 'brand';

type Props = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
  style?: StyleProp<TextStyle>;
};

export function Text({ variant = 'body', color = 'primary', style, ...rest }: Props) {
  const { tokens, primitives } = useTheme();

  const colorMap: Record<TextColor, string> = {
    primary: tokens.textPrimary,
    muted: tokens.textMuted,
    onBrand: tokens.textOnBrand,
    brand: tokens.brandSolid, // brand-700 — ผ่าน AA ห้ามใช้ brandAccent ตรงนี้
  };

  const isHeading = variant === 'display' || variant === 'h1' || variant === 'h2' || variant === 'h3';

  return (
    <RNText
      // ปิดตายที่นี่ที่เดียวตาม Global Constraints
      allowFontScaling={false}
      style={[
        {
          fontSize: primitives.fontSize[variant],
          lineHeight: primitives.lineHeight[variant],
          color: colorMap[color],
          fontFamily: isHeading ? primitives.fontFamily.heading : primitives.fontFamily.body,
        },
        style,
      ]}
      {...rest}
    />
  );
}
```

- [ ] **Step 4: รันเทสต์**

Run: `cd apps/mobile && npm test -- Text`
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui/Text.tsx apps/mobile/__tests__/ui/Text.test.tsx
git commit -m "feat: add Text component enforcing font-scaling and Thai line-height rules"
```

---

### Task 6: UI Button component

**Files:**
- Create: `apps/mobile/src/ui/Button.tsx`
- Test: `apps/mobile/__tests__/ui/Button.test.tsx`

**Interfaces:**
- Consumes: `useTheme()` (Task 3), `Text` (Task 5)
- Produces: `<Button label variant? onPress disabled? testID? />` — `variant: 'primary'|'secondary'` (ค่าเริ่มต้น `primary`)

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/ui/Button.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../../src/ui/Button';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { contrastRatio } from '../../src/theme/tokens/contrast';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider forceScheme="light">{ui}</ThemeProvider>);

function flatStyle(el: any) {
  const s = el.props.style;
  return Array.isArray(s) ? Object.assign({}, ...s.flat().filter(Boolean)) : s;
}

describe('Button', () => {
  it('ปุ่มหลักใช้ brand-700 ไม่ใช่ brand-500', () => {
    wrap(<Button testID="b" label="ตกลง" onPress={() => {}} />);
    expect(flatStyle(screen.getByTestId('b')).backgroundColor).toBe('#D23A01');
  });

  it('พื้นปุ่มกับตัวหนังสือผ่าน AA', () => {
    wrap(<Button testID="b" label="ตกลง" onPress={() => {}} />);
    const bg = flatStyle(screen.getByTestId('b')).backgroundColor;
    expect(contrastRatio('#FFFFFF', bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('พื้นที่แตะสูงอย่างน้อย 44', () => {
    wrap(<Button testID="b" label="ตกลง" onPress={() => {}} />);
    expect(flatStyle(screen.getByTestId('b')).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('กดแล้วเรียก onPress', () => {
    const fn = jest.fn();
    wrap(<Button testID="b" label="ตกลง" onPress={fn} />);
    fireEvent.press(screen.getByTestId('b'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ปิดใช้งานแล้วไม่เรียก onPress', () => {
    const fn = jest.fn();
    wrap(<Button testID="b" label="ตกลง" onPress={fn} disabled />);
    fireEvent.press(screen.getByTestId('b'));
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- Button`
Expected: FAIL — "Cannot find module '../../src/ui/Button'"

- [ ] **Step 3: เขียน Button**

สร้าง `apps/mobile/src/ui/Button.tsx`:

```tsx
import React from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', disabled, testID, style }: Props) {
  const { tokens, primitives } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          // brandSolid = brand-700 เท่านั้น — brand-500 ไม่ผ่าน contrast กับตัวหนังสือ
          backgroundColor: isPrimary ? tokens.brandSolid : 'transparent',
          borderWidth: isPrimary ? 0 : 1,
          borderColor: tokens.brandSolid,
          minHeight: 48,
          paddingHorizontal: primitives.space.xl,
          borderRadius: primitives.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text variant="body" color={isPrimary ? 'onBrand' : 'brand'}>
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: รันเทสต์**

Run: `cd apps/mobile && npm test -- Button`
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui/Button.tsx apps/mobile/__tests__/ui/Button.test.tsx
git commit -m "feat: add Button component with contrast-safe brand color"
```

---

### Task 7: Domain types และ capability logic

**Files:**
- Create: `apps/mobile/src/data/types/index.ts`
- Create: `apps/mobile/src/lib/capabilities.ts`
- Test: `apps/mobile/__tests__/lib/capabilities.test.ts`

**Interfaces:**
- Consumes: ไม่มี
- Produces:
  - `type AccountType = 'user' | 'rider' | 'admin'`
  - `type Capability = 'customer' | 'merchant' | 'rider' | 'admin'`
  - `type RiderApprovalStatus = 'pending' | 'approved' | 'rejected'`
  - `interface Account { id, accountType, username, fullName, phone, riderApproval?, ownedRestaurantIds }`
  - `capabilitiesOf(account: Account, restaurants: Restaurant[]): Capability[]`
  - `interface Restaurant { id, ownerUserId, name, isApproved, isOpen }`

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/lib/capabilities.test.ts`:

```ts
import { capabilitiesOf } from '../../src/lib/capabilities';
import type { Account, Restaurant } from '../../src/data/types';

const base: Account = {
  id: 'u1',
  accountType: 'user',
  username: 'somchai',
  fullName: 'สมชาย ใจดี',
  phone: '0812345678',
  ownedRestaurantIds: [],
};

const approvedShop: Restaurant = {
  id: 'r1', ownerUserId: 'u1', name: 'ร้านทดสอบ', isApproved: true, isOpen: true,
};
const pendingShop: Restaurant = { ...approvedShop, id: 'r2', isApproved: false };

describe('capabilitiesOf', () => {
  it('บัญชี user ธรรมดาได้ customer อย่างเดียว', () => {
    expect(capabilitiesOf(base, [])).toEqual(['customer']);
  });

  it('user ที่มีร้านอนุมัติแล้วได้ customer + merchant', () => {
    const acc = { ...base, ownedRestaurantIds: ['r1'] };
    expect(capabilitiesOf(acc, [approvedShop]).sort()).toEqual(['customer', 'merchant']);
  });

  it('user ที่มีร้านรออนุมัติยังไม่ได้ merchant', () => {
    const acc = { ...base, ownedRestaurantIds: ['r2'] };
    expect(capabilitiesOf(acc, [pendingShop])).toEqual(['customer']);
  });

  it('rider ที่อนุมัติแล้วได้ rider + customer', () => {
    const acc: Account = { ...base, accountType: 'rider', riderApproval: 'approved' };
    expect(capabilitiesOf(acc, []).sort()).toEqual(['customer', 'rider']);
  });

  it('rider ที่รออนุมัติไม่ได้ capability ใดเลย รวมทั้งการสั่งอาหาร', () => {
    const acc: Account = { ...base, accountType: 'rider', riderApproval: 'pending' };
    expect(capabilitiesOf(acc, [])).toEqual([]);
  });

  it('rider ที่ถูกปฏิเสธไม่ได้ capability ใดเลย', () => {
    const acc: Account = { ...base, accountType: 'rider', riderApproval: 'rejected' };
    expect(capabilitiesOf(acc, [])).toEqual([]);
  });

  it('admin ได้ admin อย่างเดียว ไม่ได้ customer', () => {
    const acc: Account = { ...base, accountType: 'admin' };
    expect(capabilitiesOf(acc, [])).toEqual(['admin']);
  });

  it('ร้านของคนอื่นไม่ทำให้ได้ merchant', () => {
    const other: Restaurant = { ...approvedShop, id: 'r9', ownerUserId: 'u2' };
    expect(capabilitiesOf(base, [other])).toEqual(['customer']);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- capabilities`
Expected: FAIL — "Cannot find module '../../src/lib/capabilities'"

- [ ] **Step 3: เขียน types**

สร้าง `apps/mobile/src/data/types/index.ts`:

```ts
export type AccountType = 'user' | 'rider' | 'admin';
export type Capability = 'customer' | 'merchant' | 'rider' | 'admin';
export type RiderApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Account {
  id: string;
  accountType: AccountType;
  username: string;
  fullName: string;
  phone: string;
  /** มีค่าเฉพาะเมื่อ accountType === 'rider' */
  riderApproval?: RiderApprovalStatus;
  ownedRestaurantIds: string[];
}

export interface Restaurant {
  id: string;
  ownerUserId: string;
  name: string;
  isApproved: boolean;
  isOpen: boolean;
}
```

- [ ] **Step 4: เขียน capabilities.ts**

สร้าง `apps/mobile/src/lib/capabilities.ts`:

```ts
import type { Account, Capability, Restaurant } from '../data/types';

/**
 * Navigation อ่านจากผลลัพธ์ของฟังก์ชันนี้ ไม่ใช่จาก accountType ตรง ๆ
 * ตาม claude.md §4 — merchant และ customer เป็น capability ไม่ใช่ account type
 */
export function capabilitiesOf(account: Account, restaurants: Restaurant[]): Capability[] {
  if (account.accountType === 'admin') return ['admin'];

  if (account.accountType === 'rider') {
    // ไรเดอร์ที่ยังไม่ผ่านการอนุมัติเข้าอะไรไม่ได้เลย รวมทั้งการสั่งอาหาร
    if (account.riderApproval !== 'approved') return [];
    return ['rider', 'customer'];
  }

  const caps: Capability[] = ['customer'];
  const hasApprovedShop = restaurants.some(
    (r) => r.ownerUserId === account.id && r.isApproved,
  );
  if (hasApprovedShop) caps.push('merchant');
  return caps;
}
```

- [ ] **Step 5: รันเทสต์**

Run: `cd apps/mobile && npm test -- capabilities`
Expected: PASS — 8 tests passed

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/data/types apps/mobile/src/lib/capabilities.ts apps/mobile/__tests__/lib
git commit -m "feat: add domain types and capability-based access logic"
```

---

### Task 8: Order state machine

**Files:**
- Modify: `apps/mobile/src/data/types/index.ts` (เพิ่ม Order types)
- Create: `apps/mobile/src/data/orderStateMachine.ts`
- Test: `apps/mobile/__tests__/data/orderStateMachine.test.ts`

**Interfaces:**
- Consumes: types จาก Task 7
- Produces:
  - `type OrderStatus = 'created'|'accepted'|'preparing'|'picked_up'|'delivered'|'cancelled'`
  - `canTransition(from: OrderStatus, to: OrderStatus): boolean`
  - `assertTransition(from: OrderStatus, to: OrderStatus): void` — throw `InvalidTransitionError`
  - `class InvalidTransitionError extends Error`
  - `interface Order { id, customerId, restaurantId, riderId?, status, items, foodTotal, deliveryFee, serviceFee, createdAt }`
  - `interface OrderItem { menuItemId, name, unitPrice, quantity }`

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/data/orderStateMachine.test.ts`:

```ts
import {
  canTransition,
  assertTransition,
  InvalidTransitionError,
} from '../../src/data/orderStateMachine';

describe('order state machine', () => {
  it('เส้นทางปกติผ่านทุกขั้น', () => {
    expect(canTransition('created', 'accepted')).toBe(true);
    expect(canTransition('accepted', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'picked_up')).toBe(true);
    expect(canTransition('picked_up', 'delivered')).toBe(true);
  });

  it('ยกเลิกได้ก่อนรับของ', () => {
    expect(canTransition('created', 'cancelled')).toBe(true);
    expect(canTransition('accepted', 'cancelled')).toBe(true);
    expect(canTransition('preparing', 'cancelled')).toBe(true);
  });

  it('ยกเลิกหลังรับของแล้วไม่ได้', () => {
    expect(canTransition('picked_up', 'cancelled')).toBe(false);
  });

  it('ห้ามข้ามขั้น', () => {
    expect(canTransition('created', 'delivered')).toBe(false);
    expect(canTransition('created', 'picked_up')).toBe(false);
    expect(canTransition('accepted', 'delivered')).toBe(false);
  });

  it('ห้ามถอยหลัง', () => {
    expect(canTransition('delivered', 'picked_up')).toBe(false);
    expect(canTransition('preparing', 'created')).toBe(false);
  });

  it('สถานะสุดท้ายไปไหนไม่ได้อีก', () => {
    expect(canTransition('delivered', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'accepted')).toBe(false);
  });

  it('assertTransition โยน error เมื่อไม่ถูกต้อง', () => {
    expect(() => assertTransition('created', 'delivered')).toThrow(InvalidTransitionError);
  });

  it('assertTransition เงียบเมื่อถูกต้อง', () => {
    expect(() => assertTransition('created', 'accepted')).not.toThrow();
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- orderStateMachine`
Expected: FAIL — "Cannot find module '../../src/data/orderStateMachine'"

- [ ] **Step 3: เพิ่ม Order types**

เพิ่มท้ายไฟล์ `apps/mobile/src/data/types/index.ts`:

```ts
export type OrderStatus =
  | 'created' | 'accepted' | 'preparing' | 'picked_up' | 'delivered' | 'cancelled';

export interface OrderItem {
  menuItemId: string;
  name: string;
  /** หน่วยเป็นสตางค์ เพื่อเลี่ยงความคลาดเคลื่อนของทศนิยม ตาม claude.md §7 */
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  riderId?: string;
  status: OrderStatus;
  items: OrderItem[];
  /** ทั้งสามค่าแยกกันเสมอ ห้ามรวบเป็นก้อนเดียว ตาม claude.md §3 หลักการ 2 */
  foodTotal: number;
  deliveryFee: number;
  serviceFee: number;
  createdAt: string;
}
```

- [ ] **Step 4: เขียน state machine**

สร้าง `apps/mobile/src/data/orderStateMachine.ts`:

```ts
import type { OrderStatus } from './types';

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`เปลี่ยนสถานะออร์เดอร์จาก "${from}" ไป "${to}" ไม่ได้`);
    this.name = 'InvalidTransitionError';
  }
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  created: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['picked_up', 'cancelled'],
  picked_up: ['delivered'], // เลยจุดนี้ยกเลิกไม่ได้ ต้องใช้กระบวนการคืนเงินแทน
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
```

- [ ] **Step 5: รันเทสต์**

Run: `cd apps/mobile && npm test -- orderStateMachine`
Expected: PASS — 8 tests passed

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/data apps/mobile/__tests__/data
git commit -m "feat: add order state machine with invalid-transition guards"
```

---

### Task 9: กฎ conflict-of-interest

**Files:**
- Create: `apps/mobile/src/lib/rules.ts`
- Test: `apps/mobile/__tests__/lib/rules.test.ts`

**Interfaces:**
- Consumes: types จาก Task 7 และ 8
- Produces:
  - `canOrderFromRestaurant(accountId: string, restaurant: Restaurant): boolean`
  - `canRiderAcceptOrder(riderId: string, order: Order): boolean`

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/lib/rules.test.ts`:

```ts
import { canOrderFromRestaurant, canRiderAcceptOrder } from '../../src/lib/rules';
import type { Restaurant, Order } from '../../src/data/types';

const shop: Restaurant = {
  id: 'r1', ownerUserId: 'u1', name: 'ร้านสมชาย', isApproved: true, isOpen: true,
};

const order: Order = {
  id: 'o1', customerId: 'u5', restaurantId: 'r1', status: 'accepted',
  items: [], foodTotal: 15000, deliveryFee: 1500, serviceFee: 500,
  createdAt: '2026-07-21T10:00:00Z',
};

describe('canOrderFromRestaurant', () => {
  it('เจ้าของร้านสั่งจากร้านตัวเองไม่ได้', () => {
    expect(canOrderFromRestaurant('u1', shop)).toBe(false);
  });

  it('คนอื่นสั่งได้', () => {
    expect(canOrderFromRestaurant('u2', shop)).toBe(true);
  });

  it('ร้านปิดอยู่สั่งไม่ได้', () => {
    expect(canOrderFromRestaurant('u2', { ...shop, isOpen: false })).toBe(false);
  });

  it('ร้านที่ยังไม่อนุมัติสั่งไม่ได้', () => {
    expect(canOrderFromRestaurant('u2', { ...shop, isApproved: false })).toBe(false);
  });
});

describe('canRiderAcceptOrder', () => {
  it('ไรเดอร์รับงานส่งออร์เดอร์ที่ตัวเองสั่งไม่ได้', () => {
    expect(canRiderAcceptOrder('u5', order)).toBe(false);
  });

  it('ไรเดอร์คนอื่นรับได้', () => {
    expect(canRiderAcceptOrder('u9', order)).toBe(true);
  });

  it('ออร์เดอร์ที่มีไรเดอร์แล้วรับซ้ำไม่ได้', () => {
    expect(canRiderAcceptOrder('u9', { ...order, riderId: 'u8' })).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- rules`
Expected: FAIL — "Cannot find module '../../src/lib/rules'"

- [ ] **Step 3: เขียน rules.ts**

สร้าง `apps/mobile/src/lib/rules.ts`:

```ts
import type { Order, Restaurant } from '../data/types';

/**
 * กฎกันผลประโยชน์ทับซ้อนตาม claude.md §4
 * รวมไว้ที่ไฟล์เดียวเพื่อให้ย้ายไปฝั่งเซิร์ฟเวอร์ได้โดยไม่ต้องไล่หา
 * ในรอบนี้บังคับที่ฝั่งแอปเพราะยังไม่มีเซิร์ฟเวอร์ — ของจริงต้องเช็คซ้ำที่เซิร์ฟเวอร์
 */

export function canOrderFromRestaurant(accountId: string, restaurant: Restaurant): boolean {
  if (restaurant.ownerUserId === accountId) return false;
  if (!restaurant.isApproved) return false;
  if (!restaurant.isOpen) return false;
  return true;
}

export function canRiderAcceptOrder(riderId: string, order: Order): boolean {
  if (order.customerId === riderId) return false;
  if (order.riderId) return false;
  return true;
}
```

- [ ] **Step 4: รันเทสต์**

Run: `cd apps/mobile && npm test -- rules`
Expected: PASS — 7 tests passed

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/rules.ts apps/mobile/__tests__/lib/rules.test.ts
git commit -m "feat: add conflict-of-interest rules for ordering and dispatch"
```

---

### Task 10: Repository interfaces + HttpRepo stub + จุดสลับ

**Files:**
- Create: `apps/mobile/src/data/repositories/index.ts`
- Create: `apps/mobile/src/data/http/index.ts`
- Create: `apps/mobile/src/data/index.ts`
- Test: `apps/mobile/__tests__/data/repositories.test.ts`

**Interfaces:**
- Consumes: types จาก Task 7–8
- Produces:
  - `interface AuthRepo { login(username, password): Promise<Account>; register(input): Promise<Account>; verifyOtp(accountId, code): Promise<boolean>; logout(): Promise<void> }`
  - `interface CatalogRepo { listRestaurants(): Promise<Restaurant[]>; getRestaurant(id): Promise<Restaurant | null> }`
  - `interface OrderRepo { create(input): Promise<Order>; get(id): Promise<Order | null>; listForCustomer(customerId): Promise<Order[]>; updateStatus(id, status): Promise<Order> }`
  - `interface Repos { auth: AuthRepo; catalog: CatalogRepo; orders: OrderRepo }`
  - `class NotImplementedError extends Error`
  - `createHttpRepos(baseUrl: string): Repos`

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/data/repositories.test.ts`:

```ts
import { createHttpRepos, NotImplementedError } from '../../src/data/http';

describe('HttpRepo stub', () => {
  const repos = createHttpRepos('https://example.invalid');

  it('มี repo ครบทุกตัวตาม interface', () => {
    expect(repos.auth).toBeDefined();
    expect(repos.catalog).toBeDefined();
    expect(repos.orders).toBeDefined();
  });

  it('ทุก method โยน NotImplementedError ไม่ใช่เงียบ ๆ', async () => {
    await expect(repos.auth.login('a', 'b')).rejects.toThrow(NotImplementedError);
    await expect(repos.catalog.listRestaurants()).rejects.toThrow(NotImplementedError);
    await expect(repos.orders.get('o1')).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- repositories`
Expected: FAIL — "Cannot find module '../../src/data/http'"

- [ ] **Step 3: เขียน interface**

สร้าง `apps/mobile/src/data/repositories/index.ts`:

```ts
import type { Account, AccountType, Order, OrderItem, OrderStatus, Restaurant } from '../types';

export interface RegisterInput {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  accountType: AccountType;
}

export interface CreateOrderInput {
  customerId: string;
  restaurantId: string;
  items: OrderItem[];
  deliveryFee: number;
  serviceFee: number;
}

export interface AuthRepo {
  login(username: string, password: string): Promise<Account>;
  register(input: RegisterInput): Promise<Account>;
  verifyOtp(accountId: string, code: string): Promise<boolean>;
  logout(): Promise<void>;
}

export interface CatalogRepo {
  listRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;
}

export interface OrderRepo {
  create(input: CreateOrderInput): Promise<Order>;
  get(id: string): Promise<Order | null>;
  listForCustomer(customerId: string): Promise<Order[]>;
  updateStatus(id: string, status: OrderStatus): Promise<Order>;
}

export interface Repos {
  auth: AuthRepo;
  catalog: CatalogRepo;
  orders: OrderRepo;
}
```

- [ ] **Step 4: เขียน HttpRepo stub**

สร้าง `apps/mobile/src/data/http/index.ts`:

```ts
import type { Repos } from '../repositories';

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} ยังไม่ได้ต่อ backend จริง — ตอนนี้ใช้ mock อยู่`);
    this.name = 'NotImplementedError';
  }
}

const nope = (method: string) => async (): Promise<never> => {
  throw new NotImplementedError(method);
};

/**
 * Stub ที่ implement interface ครบทุก method เพื่อให้ type ตรงกับ MockRepo
 * ไม่ใช่ไฟล์ว่าง — ความครบของ type คือสิ่งที่พิสูจน์ว่าสลับ implementation ได้จริง
 */
export function createHttpRepos(_baseUrl: string): Repos {
  return {
    auth: {
      login: nope('auth.login'),
      register: nope('auth.register'),
      verifyOtp: nope('auth.verifyOtp'),
      logout: nope('auth.logout'),
    },
    catalog: {
      listRestaurants: nope('catalog.listRestaurants'),
      getRestaurant: nope('catalog.getRestaurant'),
    },
    orders: {
      create: nope('orders.create'),
      get: nope('orders.get'),
      listForCustomer: nope('orders.listForCustomer'),
      updateStatus: nope('orders.updateStatus'),
    },
  };
}
```

- [ ] **Step 5: รันเทสต์**

Run: `cd apps/mobile && npm test -- repositories`
Expected: PASS — 2 tests passed

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/data apps/mobile/__tests__/data/repositories.test.ts
git commit -m "feat: define repository interfaces and type-complete HTTP stub"
```

---

### Task 11: MockRepo + seed data

**Files:**
- Create: `apps/mobile/src/data/mock/seed.ts`
- Create: `apps/mobile/src/data/mock/index.ts`
- Modify: `apps/mobile/src/data/index.ts`
- Test: `apps/mobile/__tests__/data/mockRepos.test.ts`

**Interfaces:**
- Consumes: `Repos` interface (Task 10), state machine (Task 8), rules (Task 9)
- Produces:
  - `createMockRepos(): Repos`
  - `seedAccounts: Account[]` — มี `somchai` (user), `malee` (user เจ้าของร้านอนุมัติแล้ว), `rider_ann` (rider approved), `rider_new` (rider pending), `admin_root` (admin) — รหัสผ่านทุกบัญชีคือ `1234`
  - `seedRestaurants: Restaurant[]`
  - `repos: Repos` (จาก `src/data/index.ts`)

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/data/mockRepos.test.ts`:

```ts
import { createMockRepos } from '../../src/data/mock';
import { InvalidTransitionError } from '../../src/data/orderStateMachine';

describe('MockRepo — auth', () => {
  it('ล็อกอินด้วยรหัสถูกต้องได้บัญชีกลับมา', async () => {
    const repos = createMockRepos();
    const acc = await repos.auth.login('somchai', '1234');
    expect(acc.username).toBe('somchai');
    expect(acc.accountType).toBe('user');
  });

  it('รหัสผิดต้อง reject', async () => {
    const repos = createMockRepos();
    await expect(repos.auth.login('somchai', 'wrong')).rejects.toThrow();
  });

  it('ไรเดอร์ที่รออนุมัติล็อกอินได้แต่สถานะเป็น pending', async () => {
    const repos = createMockRepos();
    const acc = await repos.auth.login('rider_new', '1234');
    expect(acc.riderApproval).toBe('pending');
  });
});

describe('MockRepo — orders', () => {
  it('สร้างออร์เดอร์แล้วคำนวณ foodTotal จากรายการ', async () => {
    const repos = createMockRepos();
    const order = await repos.orders.create({
      customerId: 'u-somchai',
      restaurantId: 'r-malee',
      items: [
        { menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 2 },
        { menuItemId: 'm2', name: 'น้ำส้ม', unitPrice: 2500, quantity: 1 },
      ],
      deliveryFee: 1500,
      serviceFee: 500,
    });
    expect(order.foodTotal).toBe(12500);
    expect(order.deliveryFee).toBe(1500);
    expect(order.serviceFee).toBe(500);
    expect(order.status).toBe('created');
  });

  it('เปลี่ยนสถานะตามลำดับได้', async () => {
    const repos = createMockRepos();
    const order = await repos.orders.create({
      customerId: 'u-somchai', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500, serviceFee: 500,
    });
    const accepted = await repos.orders.updateStatus(order.id, 'accepted');
    expect(accepted.status).toBe('accepted');
  });

  it('ข้ามขั้นตอนต้องโยน InvalidTransitionError', async () => {
    const repos = createMockRepos();
    const order = await repos.orders.create({
      customerId: 'u-somchai', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500, serviceFee: 500,
    });
    await expect(repos.orders.updateStatus(order.id, 'delivered')).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it('แต่ละ instance แยก state จากกัน', async () => {
    const a = createMockRepos();
    const b = createMockRepos();
    await a.orders.create({
      customerId: 'u-somchai', restaurantId: 'r-malee',
      items: [{ menuItemId: 'm1', name: 'ข้าวมันไก่', unitPrice: 5000, quantity: 1 }],
      deliveryFee: 1500, serviceFee: 500,
    });
    expect(await b.orders.listForCustomer('u-somchai')).toHaveLength(0);
  });
});

describe('MockRepo — catalog', () => {
  it('มีร้านที่อนุมัติแล้วอย่างน้อยหนึ่งร้าน', async () => {
    const repos = createMockRepos();
    const list = await repos.catalog.listRestaurants();
    expect(list.filter((r) => r.isApproved).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- mockRepos`
Expected: FAIL — "Cannot find module '../../src/data/mock'"

- [ ] **Step 3: เขียน seed data**

สร้าง `apps/mobile/src/data/mock/seed.ts`:

```ts
import type { Account, Restaurant } from '../types';

/** รหัสผ่านของทุกบัญชีทดสอบคือ 1234 */
export const MOCK_PASSWORD = '1234';

export const seedAccounts: Account[] = [
  {
    id: 'u-somchai', accountType: 'user', username: 'somchai',
    fullName: 'สมชาย ใจดี', phone: '0812345678', ownedRestaurantIds: [],
  },
  {
    id: 'u-malee', accountType: 'user', username: 'malee',
    fullName: 'มาลี ศรีสุข', phone: '0823456789', ownedRestaurantIds: ['r-malee'],
  },
  {
    id: 'u-ann', accountType: 'rider', username: 'rider_ann',
    fullName: 'อรอนงค์ ว่องไว', phone: '0834567890',
    riderApproval: 'approved', ownedRestaurantIds: [],
  },
  {
    id: 'u-new', accountType: 'rider', username: 'rider_new',
    fullName: 'ณัฐพล เพิ่งสมัคร', phone: '0845678901',
    riderApproval: 'pending', ownedRestaurantIds: [],
  },
  {
    id: 'u-admin', accountType: 'admin', username: 'admin_root',
    fullName: 'ผู้ดูแลระบบ', phone: '0856789012', ownedRestaurantIds: [],
  },
];

export const seedRestaurants: Restaurant[] = [
  { id: 'r-malee', ownerUserId: 'u-malee', name: 'ครัวมาลี', isApproved: true, isOpen: true },
  { id: 'r-somtam', ownerUserId: 'u-other', name: 'ส้มตำแซ่บนัว', isApproved: true, isOpen: true },
  { id: 'r-closed', ownerUserId: 'u-other', name: 'ก๋วยเตี๋ยวเรือ', isApproved: true, isOpen: false },
  { id: 'r-pending', ownerUserId: 'u-somchai', name: 'ร้านรออนุมัติ', isApproved: false, isOpen: false },
];
```

- [ ] **Step 4: เขียน MockRepo**

สร้าง `apps/mobile/src/data/mock/index.ts`:

```ts
import type { Repos, RegisterInput, CreateOrderInput } from '../repositories';
import type { Account, Order, Restaurant } from '../types';
import { assertTransition } from '../orderStateMachine';
import { seedAccounts, seedRestaurants, MOCK_PASSWORD } from './seed';

export function createMockRepos(): Repos {
  // state แยกต่อ instance เพื่อให้เทสต์ไม่รบกวนกัน
  const accounts: Account[] = seedAccounts.map((a) => ({ ...a }));
  const restaurants: Restaurant[] = seedRestaurants.map((r) => ({ ...r }));
  const orders: Order[] = [];
  let seq = 0;

  const delay = () => new Promise<void>((r) => setTimeout(r, 0));

  return {
    auth: {
      async login(username, password) {
        await delay();
        const acc = accounts.find((a) => a.username === username);
        if (!acc || password !== MOCK_PASSWORD) {
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        return { ...acc };
      },
      async register(input: RegisterInput) {
        await delay();
        if (accounts.some((a) => a.username === input.username)) {
          throw new Error('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
        }
        const acc: Account = {
          id: `u-${++seq}`,
          accountType: input.accountType,
          username: input.username,
          fullName: input.fullName,
          phone: input.phone,
          ownedRestaurantIds: [],
          ...(input.accountType === 'rider' ? { riderApproval: 'pending' as const } : {}),
        };
        accounts.push(acc);
        return { ...acc };
      },
      async verifyOtp(_accountId, code) {
        await delay();
        return code === '123456';
      },
      async logout() {
        await delay();
      },
    },

    catalog: {
      async listRestaurants() {
        await delay();
        return restaurants.map((r) => ({ ...r }));
      },
      async getRestaurant(id) {
        await delay();
        const r = restaurants.find((x) => x.id === id);
        return r ? { ...r } : null;
      },
    },

    orders: {
      async create(input: CreateOrderInput) {
        await delay();
        const foodTotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const order: Order = {
          id: `o-${++seq}`,
          customerId: input.customerId,
          restaurantId: input.restaurantId,
          status: 'created',
          items: input.items.map((i) => ({ ...i })),
          foodTotal,
          deliveryFee: input.deliveryFee,
          serviceFee: input.serviceFee,
          createdAt: new Date().toISOString(),
        };
        orders.push(order);
        return { ...order };
      },
      async get(id) {
        await delay();
        const o = orders.find((x) => x.id === id);
        return o ? { ...o } : null;
      },
      async listForCustomer(customerId) {
        await delay();
        return orders.filter((o) => o.customerId === customerId).map((o) => ({ ...o }));
      },
      async updateStatus(id, status) {
        await delay();
        const o = orders.find((x) => x.id === id);
        if (!o) throw new Error(`ไม่พบออร์เดอร์ ${id}`);
        assertTransition(o.status, status); // โยน InvalidTransitionError ถ้าข้ามขั้น
        o.status = status;
        return { ...o };
      },
    },
  };
}
```

- [ ] **Step 5: เขียนจุดสลับ mock ↔ http**

สร้าง `apps/mobile/src/data/index.ts`:

```ts
import type { Repos } from './repositories';
import { createMockRepos } from './mock';
import { createHttpRepos } from './http';

/** จุดเดียวในโปรเจกต์ที่ตัดสินว่าใช้ mock หรือ API จริง */
const USE_MOCK = true;
const API_BASE_URL = 'https://api.wingdai.invalid';

export const repos: Repos = USE_MOCK ? createMockRepos() : createHttpRepos(API_BASE_URL);

export type { Repos } from './repositories';
```

- [ ] **Step 6: รันเทสต์ทั้งหมด**

Run: `cd apps/mobile && npm test`
Expected: PASS — ทุกเทสต์ผ่าน

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/data apps/mobile/__tests__/data
git commit -m "feat: add mock repositories with stateful seed data"
```

---

### Task 12: Auth store (Zustand)

**Files:**
- Create: `apps/mobile/src/features/auth/authStore.ts`
- Test: `apps/mobile/__tests__/features/authStore.test.ts`

**Interfaces:**
- Consumes: `repos` (Task 11), `capabilitiesOf` (Task 7)
- Produces: `useAuthStore` — state `{ account: Account | null; restaurants: Restaurant[]; capabilities: Capability[]; activeCapability: Capability | null; isLoading: boolean; error: string | null }`, actions `login(username, password)`, `logout()`, `setActiveCapability(cap)`

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/features/authStore.test.ts`:

```ts
import { useAuthStore } from '../../src/features/auth/authStore';

beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [],
    activeCapability: null, isLoading: false, error: null,
  });
});

describe('authStore', () => {
  it('ล็อกอินเป็น user ธรรมดาได้ capability customer และตั้งเป็น active', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    const s = useAuthStore.getState();
    expect(s.account?.username).toBe('somchai');
    expect(s.capabilities).toEqual(['customer']);
    expect(s.activeCapability).toBe('customer');
    expect(s.error).toBeNull();
  });

  it('ล็อกอินเป็นเจ้าของร้านได้ทั้ง customer และ merchant', async () => {
    await useAuthStore.getState().login('malee', '1234');
    expect(useAuthStore.getState().capabilities.sort()).toEqual(['customer', 'merchant']);
  });

  it('ไรเดอร์ที่อนุมัติแล้วได้ rider เป็น active เริ่มต้น', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    const s = useAuthStore.getState();
    expect(s.capabilities.sort()).toEqual(['customer', 'rider']);
    expect(s.activeCapability).toBe('rider');
  });

  it('ไรเดอร์ที่รออนุมัติไม่มี capability เลย', async () => {
    await useAuthStore.getState().login('rider_new', '1234');
    const s = useAuthStore.getState();
    expect(s.capabilities).toEqual([]);
    expect(s.activeCapability).toBeNull();
  });

  it('รหัสผิดเก็บ error และไม่ล็อกอิน', async () => {
    await useAuthStore.getState().login('somchai', 'wrong');
    const s = useAuthStore.getState();
    expect(s.account).toBeNull();
    expect(s.error).toBeTruthy();
  });

  it('สลับ capability ที่มีสิทธิ์ได้', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    useAuthStore.getState().setActiveCapability('customer');
    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('สลับไป capability ที่ไม่มีสิทธิ์ไม่ได้', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    useAuthStore.getState().setActiveCapability('admin');
    expect(useAuthStore.getState().activeCapability).toBe('customer');
  });

  it('ออกจากระบบล้าง state', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.account).toBeNull();
    expect(s.capabilities).toEqual([]);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- authStore`
Expected: FAIL — "Cannot find module '../../src/features/auth/authStore'"

- [ ] **Step 3: เขียน authStore**

สร้าง `apps/mobile/src/features/auth/authStore.ts`:

```ts
import { create } from 'zustand';
import { repos } from '../../data';
import { capabilitiesOf } from '../../lib/capabilities';
import type { Account, Capability, Restaurant } from '../../data/types';

type AuthState = {
  account: Account | null;
  restaurants: Restaurant[];
  capabilities: Capability[];
  activeCapability: Capability | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveCapability: (cap: Capability) => void;
};

/** ลำดับความสำคัญของ stack เริ่มต้นเมื่อมีหลาย capability */
function defaultCapability(caps: Capability[]): Capability | null {
  const order: Capability[] = ['admin', 'rider', 'merchant', 'customer'];
  return order.find((c) => caps.includes(c)) ?? null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  account: null,
  restaurants: [],
  capabilities: [],
  activeCapability: null,
  isLoading: false,
  error: null,

  async login(username, password) {
    set({ isLoading: true, error: null });
    try {
      const account = await repos.auth.login(username, password);
      const restaurants = await repos.catalog.listRestaurants();
      const capabilities = capabilitiesOf(account, restaurants);
      set({
        account,
        restaurants,
        capabilities,
        activeCapability: defaultCapability(capabilities),
        isLoading: false,
        error: null,
      });
    } catch (e) {
      set({
        account: null, restaurants: [], capabilities: [], activeCapability: null,
        isLoading: false,
        error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด',
      });
    }
  },

  async logout() {
    await repos.auth.logout();
    set({
      account: null, restaurants: [], capabilities: [],
      activeCapability: null, isLoading: false, error: null,
    });
  },

  setActiveCapability(cap) {
    // ห้ามสลับไป capability ที่บัญชีนี้ไม่มีสิทธิ์
    if (!get().capabilities.includes(cap)) return;
    set({ activeCapability: cap });
  },
}));
```

- [ ] **Step 4: รันเทสต์**

Run: `cd apps/mobile && npm test -- authStore`
Expected: PASS — 8 tests passed

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/auth apps/mobile/__tests__/features
git commit -m "feat: add auth store with capability resolution"
```

---

### Task 13: RootNavigator เลือก stack จาก capability

**Files:**
- Create: `apps/mobile/src/app/navigators/AuthStack.tsx`
- Create: `apps/mobile/src/app/navigators/PlaceholderStack.tsx`
- Create: `apps/mobile/src/app/RootNavigator.tsx`
- Test: `apps/mobile/__tests__/app/RootNavigator.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 12), `Text`/`Button` (Task 5–6), `ThemeProvider` (Task 3)
- Produces:
  - `RootNavigator` component
  - `PlaceholderStack({ name, testID })` — stack เปล่าสำหรับ Customer/Merchant/Rider/Admin ที่จะเติมในแผนถัดไป

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/app/RootNavigator.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from '../../src/app/RootNavigator';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/authStore';
import { initI18n } from '../../src/i18n';

beforeAll(async () => { await initI18n(); });

beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [],
    activeCapability: null, isLoading: false, error: null,
  });
});

const renderApp = () =>
  render(
    <ThemeProvider forceScheme="light">
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </ThemeProvider>,
  );

describe('RootNavigator', () => {
  it('ยังไม่ล็อกอินเห็นหน้าเข้าสู่ระบบ', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('screen-login')).toBeOnTheScreen());
  });

  it('user ธรรมดาเข้า CustomerStack', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    renderApp();
    await waitFor(() => expect(screen.getByTestId('stack-customer')).toBeOnTheScreen());
  });

  it('ไรเดอร์ที่อนุมัติแล้วเข้า RiderStack เป็นค่าเริ่มต้น', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    renderApp();
    await waitFor(() => expect(screen.getByTestId('stack-rider')).toBeOnTheScreen());
  });

  it('ไรเดอร์ที่อนุมัติแล้วสลับไปโหมดลูกค้าได้', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    useAuthStore.getState().setActiveCapability('customer');
    renderApp();
    await waitFor(() => expect(screen.getByTestId('stack-customer')).toBeOnTheScreen());
  });

  it('ไรเดอร์ที่รออนุมัติเห็นหน้ารออนุมัติเท่านั้น', async () => {
    await useAuthStore.getState().login('rider_new', '1234');
    renderApp();
    await waitFor(() => expect(screen.getByTestId('screen-pending')).toBeOnTheScreen());
    expect(screen.queryByTestId('stack-customer')).toBeNull();
    expect(screen.queryByTestId('stack-rider')).toBeNull();
  });

  it('เจ้าของร้านเริ่มที่ MerchantStack', async () => {
    await useAuthStore.getState().login('malee', '1234');
    renderApp();
    await waitFor(() => expect(screen.getByTestId('stack-merchant')).toBeOnTheScreen());
  });

  it('แอดมินเข้า AdminStack', async () => {
    await useAuthStore.getState().login('admin_root', '1234');
    renderApp();
    await waitFor(() => expect(screen.getByTestId('stack-admin')).toBeOnTheScreen());
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- RootNavigator`
Expected: FAIL — "Cannot find module '../../src/app/RootNavigator'"

- [ ] **Step 3: เขียน PlaceholderStack**

สร้าง `apps/mobile/src/app/navigators/PlaceholderStack.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';

/**
 * โครงเปล่าของ stack ที่จะเติมเนื้อหาในแผนถัดไป
 * มีไว้เพื่อให้ทดสอบ routing ตาม capability ได้ตั้งแต่ตอนนี้
 */
export function PlaceholderStack({ name, testID }: { name: string; testID: string }) {
  const { tokens, primitives } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: primitives.space.xl,
      }}
    >
      <Text variant="h2">{name}</Text>
    </View>
  );
}
```

- [ ] **Step 4: เขียน AuthStack พร้อมหน้า Login และ PendingApproval**

สร้าง `apps/mobile/src/app/navigators/AuthStack.tsx`:

```tsx
import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { useAuthStore } from '../../features/auth/authStore';

export function LoginScreen() {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View
      testID="screen-login"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h1">{t('auth.login.title')}</Text>

      <TextInput
        testID="input-username"
        accessibilityLabel={t('auth.login.username')}
        placeholder={t('auth.login.username')}
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        style={{
          borderWidth: 1, borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      <TextInput
        testID="input-password"
        accessibilityLabel={t('auth.login.password')}
        placeholder={t('auth.login.password')}
        placeholderTextColor={tokens.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1, borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      {error ? (
        <Text testID="login-error" variant="small" style={{ color: tokens.danger }}>
          {error}
        </Text>
      ) : null}

      <Button
        testID="btn-login"
        label={t('auth.login.submit')}
        onPress={() => login(username, password)}
      />
    </View>
  );
}

export function PendingApprovalScreen() {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View
      testID="screen-pending"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h2">{t('auth.pending.title')}</Text>
      <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
        {t('auth.pending.description')}
      </Text>
      <Button
        testID="btn-logout"
        label={t('auth.pending.logout')}
        variant="secondary"
        onPress={() => logout()}
      />
    </View>
  );
}
```

- [ ] **Step 5: เขียน RootNavigator**

สร้าง `apps/mobile/src/app/RootNavigator.tsx`:

```tsx
import React from 'react';
import { useAuthStore } from '../features/auth/authStore';
import { LoginScreen, PendingApprovalScreen } from './navigators/AuthStack';
import { PlaceholderStack } from './navigators/PlaceholderStack';

/**
 * เลือก stack จาก capability ไม่ใช่จาก accountType ตรง ๆ ตาม claude.md §4
 * การเพิ่ม capability ใหม่ในอนาคตจึงไม่ต้องรื้อโครงนี้
 */
export function RootNavigator() {
  const account = useAuthStore((s) => s.account);
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);

  if (!account) return <LoginScreen />;

  // ไรเดอร์ที่ยังไม่อนุมัติ: ไม่มี capability ใดเลย เข้าได้แค่หน้ารออนุมัติ
  if (capabilities.length === 0) return <PendingApprovalScreen />;

  switch (active) {
    case 'admin':
      return <PlaceholderStack name="Admin" testID="stack-admin" />;
    case 'rider':
      return <PlaceholderStack name="Rider" testID="stack-rider" />;
    case 'merchant':
      return <PlaceholderStack name="Merchant" testID="stack-merchant" />;
    case 'customer':
      return <PlaceholderStack name="Customer" testID="stack-customer" />;
    default:
      return <PendingApprovalScreen />;
  }
}
```

- [ ] **Step 6: รันเทสต์**

Run: `cd apps/mobile && npm test -- RootNavigator`
Expected: PASS — 7 tests passed

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/app apps/mobile/__tests__/app
git commit -m "feat: add capability-based root navigator with auth screens"
```

---

### Task 14: ประกอบ App เข้าด้วยกันและเปิดบนเครื่องจริง

**Files:**
- Modify: `apps/mobile/App.tsx`
- Create: `apps/mobile/app.config.ts`
- Test: `apps/mobile/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 1–13
- Produces: `App` component ที่ประกอบ ThemeProvider + i18n + NavigationContainer + RootNavigator

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/App.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

describe('App', () => {
  it('เปิดแอปแล้วเห็นหน้าเข้าสู่ระบบ', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('screen-login')).toBeOnTheScreen());
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- App`
Expected: FAIL — หน้า login ยังไม่ถูก render เพราะ App.tsx ยังเป็น template เดิม

- [ ] **Step 3: เขียน App.tsx**

แทนที่เนื้อหาทั้งไฟล์ `apps/mobile/App.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { RootNavigator } from './src/app/RootNavigator';
import { initI18n } from './src/i18n';

const queryClient = new QueryClient();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 4: ตั้งค่าแอปและไอคอน**

สร้าง `apps/mobile/app.config.ts`:

```ts
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Wingdai',
  slug: 'wingdai',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic', // รองรับโหมดมืดตามระบบ
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FEFBF7',
  },
  ios: { supportsTablet: false, bundleIdentifier: 'com.wingdai.app' },
  android: {
    package: 'com.wingdai.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FEFBF7',
    },
  },
};

export default config;
```

- [ ] **Step 5: เตรียมไฟล์ไอคอนจากโลโก้**

```bash
cd /Users/pannatron.r/Desktop/Food_rush_project
cp Logo/logo.png apps/mobile/assets/icon.png
cp Logo/logo.png apps/mobile/assets/adaptive-icon.png
cp Logo/stacked.png apps/mobile/assets/splash.png
```

ยืนยันว่าไฟล์มีขนาดพอ:

Run: `sips -g pixelWidth -g pixelHeight apps/mobile/assets/icon.png`
Expected: 1254 × 1254 (เกิน 1024 ที่ Expo ต้องการ)

- [ ] **Step 6: รันเทสต์ทั้งหมด**

Run: `cd apps/mobile && npm test`
Expected: PASS — ทุกเทสต์ผ่าน

- [ ] **Step 7: เปิดแอปบนเครื่องจริงและตรวจด้วยตา**

```bash
cd apps/mobile && npx expo start
```

ตรวจสี่อย่างนี้ด้วยตาแล้วบันทึกผล:
1. หน้าเข้าสู่ระบบขึ้นมา ตัวอักษรไทยไม่มีสระซ้อนทับกัน
2. ล็อกอินด้วย `somchai` / `1234` แล้วเห็นหน้าที่เขียนว่า Customer
3. สลับเครื่องเป็นโหมดมืด แล้วพื้นหลังเปลี่ยนเป็นสี teal เข้ม ตัวอักษรยังอ่านออก
4. สลับภาษาเครื่องเป็นอังกฤษ ปิดเปิดแอป แล้วข้อความเปลี่ยนเป็นอังกฤษ ปุ่มไม่ล้น

- [ ] **Step 8: Commit**

```bash
git add apps/mobile
git commit -m "feat: wire up app root with theme, i18n, navigation and Wingdai branding"
```

---

### Task 15: Role switcher

**Files:**
- Create: `apps/mobile/src/app/RoleSwitcher.tsx`
- Modify: `apps/mobile/src/app/navigators/PlaceholderStack.tsx`
- Test: `apps/mobile/__tests__/app/RoleSwitcher.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 12), `Button` (Task 6)
- Produces: `RoleSwitcher` — แสดงปุ่มสลับเฉพาะ capability ที่บัญชีมี และซ่อนตัวเองเมื่อมี capability เดียว

- [ ] **Step 1: เขียนเทสต์ให้ล้มก่อน**

สร้าง `apps/mobile/__tests__/app/RoleSwitcher.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { RoleSwitcher } from '../../src/app/RoleSwitcher';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/authStore';
import { initI18n } from '../../src/i18n';

beforeAll(async () => { await initI18n(); });

beforeEach(() => {
  useAuthStore.setState({
    account: null, restaurants: [], capabilities: [],
    activeCapability: null, isLoading: false, error: null,
  });
});

const wrap = () =>
  render(
    <ThemeProvider forceScheme="light">
      <RoleSwitcher />
    </ThemeProvider>,
  );

describe('RoleSwitcher', () => {
  it('มี capability เดียวไม่ต้องแสดงตัวสลับ', async () => {
    await useAuthStore.getState().login('somchai', '1234');
    wrap();
    expect(screen.queryByTestId('role-switcher')).toBeNull();
  });

  it('ไรเดอร์เห็นปุ่มสลับสองปุ่ม', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    wrap();
    expect(screen.getByTestId('role-switcher')).toBeOnTheScreen();
    expect(screen.getByTestId('role-btn-rider')).toBeOnTheScreen();
    expect(screen.getByTestId('role-btn-customer')).toBeOnTheScreen();
  });

  it('ไม่แสดงปุ่มของ capability ที่ไม่มีสิทธิ์', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    wrap();
    expect(screen.queryByTestId('role-btn-admin')).toBeNull();
    expect(screen.queryByTestId('role-btn-merchant')).toBeNull();
  });

  it('กดปุ่มแล้วเปลี่ยน activeCapability', async () => {
    await useAuthStore.getState().login('rider_ann', '1234');
    wrap();
    fireEvent.press(screen.getByTestId('role-btn-customer'));
    await waitFor(() =>
      expect(useAuthStore.getState().activeCapability).toBe('customer'),
    );
  });

  it('เจ้าของร้านเห็นปุ่มลูกค้าและร้านค้า', async () => {
    await useAuthStore.getState().login('malee', '1234');
    wrap();
    expect(screen.getByTestId('role-btn-customer')).toBeOnTheScreen();
    expect(screen.getByTestId('role-btn-merchant')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `cd apps/mobile && npm test -- RoleSwitcher`
Expected: FAIL — "Cannot find module '../../src/app/RoleSwitcher'"

- [ ] **Step 3: เขียน RoleSwitcher**

สร้าง `apps/mobile/src/app/RoleSwitcher.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../ui/Button';
import { useAuthStore } from '../features/auth/authStore';
import type { Capability } from '../data/types';

const LABEL_KEY: Record<Capability, string> = {
  customer: 'roleSwitcher.customer',
  merchant: 'roleSwitcher.merchant',
  rider: 'roleSwitcher.rider',
  admin: 'roleSwitcher.admin',
};

export function RoleSwitcher() {
  const { t } = useTranslation();
  const { primitives } = useTheme();
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);
  const setActive = useAuthStore((s) => s.setActiveCapability);

  // มีบทบาทเดียวก็ไม่มีอะไรให้สลับ
  if (capabilities.length < 2) return null;

  return (
    <View
      testID="role-switcher"
      style={{ flexDirection: 'row', gap: primitives.space.sm, padding: primitives.space.lg }}
    >
      {capabilities.map((cap) => (
        <Button
          key={cap}
          testID={`role-btn-${cap}`}
          label={t(LABEL_KEY[cap])}
          variant={cap === active ? 'primary' : 'secondary'}
          onPress={() => setActive(cap)}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: รันเทสต์**

Run: `cd apps/mobile && npm test -- RoleSwitcher`
Expected: PASS — 5 tests passed

- [ ] **Step 5: ใส่ RoleSwitcher ลงใน PlaceholderStack**

แทนที่เนื้อหาไฟล์ `apps/mobile/src/app/navigators/PlaceholderStack.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { RoleSwitcher } from '../RoleSwitcher';
import { useAuthStore } from '../../features/auth/authStore';
import { useTranslation } from 'react-i18next';

/**
 * โครงเปล่าของ stack ที่จะเติมเนื้อหาในแผนถัดไป
 * มีไว้เพื่อให้ทดสอบ routing ตาม capability ได้ตั้งแต่ตอนนี้
 */
export function PlaceholderStack({ name, testID }: { name: string; testID: string }) {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h2">{name}</Text>
      <RoleSwitcher />
      <Button
        testID="btn-logout"
        label={t('auth.pending.logout')}
        variant="secondary"
        onPress={() => logout()}
      />
    </View>
  );
}
```

- [ ] **Step 6: รันเทสต์ทั้งหมด**

Run: `cd apps/mobile && npm test`
Expected: PASS — ทุกเทสต์ผ่าน

- [ ] **Step 7: ตรวจด้วยตาบนเครื่องจริง**

```bash
cd apps/mobile && npx expo start
```

ล็อกอินด้วย `rider_ann` / `1234` แล้วยืนยันว่า:
1. เข้ามาเจอหน้า Rider
2. มีปุ่มสลับสองปุ่ม กดปุ่มโหมดลูกค้าแล้วเปลี่ยนเป็นหน้า Customer
3. ล็อกอินด้วย `rider_new` / `1234` แล้วเจอหน้ารออนุมัติ ไม่มีปุ่มสลับ

- [ ] **Step 8: Commit**

```bash
git add apps/mobile
git commit -m "feat: add role switcher for accounts with multiple capabilities"
```

---

## เกณฑ์ผ่านของแผนนี้

รันแล้วต้องได้ผลตามนี้ทุกข้อ พร้อมหลักฐาน

1. `cd apps/mobile && npm test` — ผ่านทั้งหมด ไม่มี skip
2. `npx expo start` เปิดบนเครื่องจริงได้ทั้ง iOS และ Android
3. ล็อกอิน `somchai`/`1234` → หน้า Customer
4. ล็อกอิน `malee`/`1234` → หน้า Merchant พร้อมปุ่มสลับไปโหมดลูกค้า
5. ล็อกอิน `rider_ann`/`1234` → หน้า Rider พร้อมปุ่มสลับไปโหมดลูกค้า
6. ล็อกอิน `rider_new`/`1234` → หน้ารออนุมัติเท่านั้น ไม่มีทางเข้า stack อื่น
7. ล็อกอิน `admin_root`/`1234` → หน้า Admin ไม่มีปุ่มสลับ
8. สลับโหมดมืดที่ระบบ → พื้นหลังเป็น teal `#023839` ตัวอักษรอ่านออก
9. สลับภาษาเครื่องเป็นอังกฤษ → ข้อความเปลี่ยน ปุ่มไม่ล้น
10. เปิด `src/data/index.ts` เปลี่ยน `USE_MOCK` เป็น `false` แล้ว `npx tsc --noEmit` ยังผ่าน โดยไม่ต้องแก้ไฟล์ใน `src/features/` หรือ `src/ui/`

---

## สิ่งที่แผนนี้ยังไม่ทำ (อยู่ในแผนถัดไป)

- หน้าจอ Register / OtpVerify / ChooseAccountType / ForgotPassword — มี i18n key พร้อมแล้วแต่ยังไม่มีหน้าจอ
- Realtime event bus จำลอง — ยังไม่จำเป็นจนกว่าจะมีหน้าติดตามออร์เดอร์
- Money component และการจัดรูปแบบสกุลเงินตาม locale
- เนื้อหาจริงของทั้ง 4 stack (43 หน้าจอ)
- การลบพื้นครีมออกจากโลโก้เพื่อใช้บนโหมดมืด
