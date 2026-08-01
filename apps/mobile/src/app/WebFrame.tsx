import type { ReactNode } from 'react';

/**
 * บนมือถือแอปกินเต็มจอตามปกติ — ไม่ต้องครอบอะไร
 * ตัวที่ทำงานจริงคือ `WebFrame.web.tsx` ซึ่ง Metro หยิบไปใช้เฉพาะตอน build เว็บ
 */
export function WebFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
