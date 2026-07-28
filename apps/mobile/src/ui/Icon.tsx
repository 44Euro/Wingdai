import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

/**
 * ไอคอนเส้น (Lucide-compatible) ตาม Wingdai design system
 * ใช้เวกเตอร์เสมอ — ห้ามใช้อีโมจิเป็นไอคอนโครงสร้าง
 */
export type IconName =
  | 'home' | 'menu' | 'history' | 'user' | 'inbox'
  | 'search' | 'chevronLeft' | 'chevronRight' | 'chevronDown'
  | 'plus' | 'minus' | 'check' | 'close'
  | 'heart' | 'star' | 'clock' | 'mapPin' | 'bike'
  | 'card' | 'qr' | 'cart' | 'store' | 'help' | 'logout' | 'edit' | 'send' | 'burger'
  | 'eye' | 'eyeOff'
  | 'rice' | 'noodle' | 'somtam' | 'drink' | 'dessert';

type Shape = {
  p?: string[];
  c?: Array<[number, number, number]>;
  r?: Array<[number, number, number, number, number]>;
};

const SHAPES: Record<IconName, Shape> = {
  home: { p: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'] },
  menu: { p: ['M3.5 12.5h17a8.5 8.5 0 0 1-17 0Z', 'M7 12.5a5 3.4 0 0 1 10 0'] },
  history: { p: ['M3.2 12a8.8 8.8 0 1 0 2.8-6.4L3 8', 'M3 4v4h4', 'M12 8v4l3 1.8'] },
  user: { p: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21c0-4 4-7 8-7s8 3 8 7'] },
  inbox: { p: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10 21a2 2 0 0 0 4 0'] },
  search: { p: ['m21 21-4.3-4.3'], c: [[11, 11, 8]] },
  chevronLeft: { p: ['m15 18-6-6 6-6'] },
  chevronRight: { p: ['m9 18 6-6-6-6'] },
  chevronDown: { p: ['m6 9 6 6 6-6'] },
  plus: { p: ['M12 5v14M5 12h14'] },
  minus: { p: ['M5 12h14'] },
  check: { p: ['M20 6 9 17l-5-5'] },
  close: { p: ['M18 6 6 18M6 6l12 12'] },
  heart: { p: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z'] },
  star: { p: ['m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1Z'] },
  clock: { p: ['M12 7v5l3 2'], c: [[12, 12, 9]] },
  mapPin: { p: ['M20 10c0 6-8 11-8 11s-8-5-8-11a8 8 0 0 1 16 0Z'], c: [[12, 10, 3]] },
  bike: { p: ['M6 17 10 7h4l2.5 5.5M13 7h3'], c: [[6, 17, 3], [18, 17, 3]] },
  card: { p: ['M3 10h18'], r: [[3, 6, 18, 13, 2.4]] },
  qr: { p: ['M9 9h1v1H9zM14 9h1v1h-1zM9 14h1v1H9zM14 14h1v1h-1z'], r: [[4, 4, 16, 16, 2]] },
  cart: { p: ['M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.5L23 7H6'], c: [[8, 21, 1], [19, 21, 1]] },
  store: { p: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18M16 10a4 4 0 0 1-8 0'] },
  help: { p: ['M12 8v4M12 16h.01'], c: [[12, 12, 9]] },
  logout: { p: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5M21 12H9'] },
  edit: { p: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'] },
  send: { p: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'] },
  // ปุ่มออร์เดอร์กลาง navbar — path ตรงกับที่ design ใช้ในจอ C1/C32
  burger: { p: ['M4 9.8a8 8 0 0 1 16 0Z', 'M3.3 13.2h17.4', 'M5 16.6h14a2.5 2.5 0 0 1-2.5 2.4H7.5A2.5 2.5 0 0 1 5 16.6Z'] },
  // สลับแสดง/ซ่อนรหัสผ่าน — A2 ใช้ไอคอนตา ไม่ใช่ปุ่มตัวหนังสือ
  eye: { p: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z'], c: [[12, 12, 3]] },
  eyeOff: { p: ['M3 3l18 18', 'M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.3 3.9', 'M6.4 6.9A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.2-.9', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'] },
  rice: { p: ['M4 3v6a2 2 0 0 0 4 0V3M6 3v18M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4V3zM16 12v9'] },
  noodle: { p: ['M3.5 12.5h17a8.5 8.5 0 0 1-17 0Z', 'M7 12.5a5 3.4 0 0 1 10 0'] },
  somtam: { p: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z', 'M2 21c0-3 1.85-5.36 5.08-6'] },
  drink: { p: ['M10 2v2M14 2v2M4 8h12a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9a1 1 0 0 1 0-1Z', 'M16 8h2a2 2 0 0 1 0 6h-1'] },
  dessert: { p: ['m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11', 'M17 7A5 5 0 0 0 7 7', 'M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4'] },
};

export function Icon({
  name,
  color,
  size = 20,
  strokeWidth = 2,
  filled = false,
}: {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
  /** ดาว/หัวใจที่ถูกเลือกใช้ทึบ — ไอคอนอื่นเป็นเส้นเสมอ */
  filled?: boolean;
}) {
  const shape = SHAPES[name];
  const common = {
    stroke: color,
    strokeWidth,
    fill: filled ? color : 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shape.r?.map(([x, y, w, h, rx], i) => (
        <Rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={rx} {...common} />
      ))}
      {shape.c?.map(([cx, cy, r], i) => (
        <Circle key={`c${i}`} cx={cx} cy={cy} r={r} {...common} />
      ))}
      {shape.p?.map((d, i) => (
        <Path key={`p${i}`} d={d} {...common} />
      ))}
    </Svg>
  );
}
