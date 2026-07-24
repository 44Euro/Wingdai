import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export type TabIconName = 'home' | 'orders' | 'inbox' | 'profile';

/**
 * ไอคอนแท็บแบบเวกเตอร์ (react-native-svg) — เส้น stroke ตาม color ที่ส่งมา
 * ตามกฎในสกิล: ใช้เวกเตอร์ ไม่ใช้อีโมจิเป็นไอคอนโครงสร้าง
 */
export function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" {...common} />}
      {name === 'orders' && (
        <>
          <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" {...common} />
          <Path d="M9 8h6M9 12h6" {...common} />
        </>
      )}
      {name === 'inbox' && (
        <>
          <Path d="M6 8a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7" {...common} />
          <Path d="M10.5 20a1.5 1.5 0 0 0 3 0" {...common} />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx={12} cy={8} r={4} {...common} />
          <Path d="M4 20c0-4 4-6 8-6s8 2 8 6" {...common} />
        </>
      )}
    </Svg>
  );
}
