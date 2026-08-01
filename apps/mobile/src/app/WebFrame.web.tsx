import React, { type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** ความกว้างจอมือถือที่ออกแบบไว้ (iPhone 16/17 Pro) — เกินกว่านี้เลย์เอาต์จะยืดจนอ่านยาก */
const PHONE_WIDTH = 430;

/**
 * กรอบมือถือสำหรับ **เว็บ** — Metro หยิบไฟล์ `.web.tsx` แทน `WebFrame.tsx` ให้เอง
 *
 * ทุกจอในแอปนี้ออกแบบมาสำหรับความกว้างมือถือ ปล่อยให้ยืดเต็มจอเดสก์ท็อปแล้ว
 * ปุ่มพิลจะยาวข้ามจอและการ์ดจะแบนจนอ่านไม่ออก — บีบไว้ที่ความกว้างเดิมแล้ววางกลางจอ
 * จอเล็กกว่านั้น (เปิดจากมือถือจริง) ให้กินเต็มจอตามเดิม ไม่ต้องมีขอบ
 */
export function WebFrame({ children }: { children: ReactNode }) {
  const { tokens, primitives: p } = useTheme();
  const { width } = useWindowDimensions();
  const framed = width > PHONE_WIDTH;

  return (
    <View
      style={{
        flex: 1,
        // นอกกรอบใช้พื้นจมของธีม เพื่อให้ตัวแอปดูลอยขึ้นมาโดยไม่ต้องเพิ่มสีใหม่นอกระบบโทเคน
        backgroundColor: framed ? tokens.bgSunken : tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: PHONE_WIDTH,
          backgroundColor: tokens.bgSurface,
          overflow: 'hidden',
          // เงา/มุมโค้งเฉพาะตอนมีพื้นที่เหลือรอบ ๆ ให้เห็น
          ...(framed
            ? {
                borderRadius: p.radius.xl,
                maxHeight: 932,
                boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
              }
            : null),
        }}
      >
        {children}
      </View>
    </View>
  );
}
