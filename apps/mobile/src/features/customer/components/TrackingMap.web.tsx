import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
// CSS ของ maplibre-gl — ไม่ใส่แล้วชั้น canvas กับปุ่มซูมจะวางผิดตำแหน่ง
// Expo SDK 57 รองรับ import ไฟล์ CSS บนเว็บ และไฟล์ `.web.tsx` ไม่ถูก resolve ตอน build เนทีฟ
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * แผนที่ของจอติดตาม ฉบับ **เว็บ** — Metro หยิบไฟล์ `.web.tsx` แทน `TrackingMap.tsx` ให้เอง
 *
 * `@maplibre/maplibre-react-native` v11 เป็นโมดูลเนทีฟล้วน ไม่มีทางฝั่งเบราว์เซอร์
 * แต่ maplibre-gl คือ **ตัวเรนเดอร์เดียวกัน** ที่รันในเบราว์เซอร์ได้ตรง ๆ
 * และกิน style URL ตัวเดียวกัน — แผนที่บนเว็บจึงเป็นแผนที่จริง ไม่ใช่กล่องเปล่าหลอกตา
 *
 * ไลบรารีนี้เข้าบันเดิลเฉพาะเว็บ เพราะไฟล์ `.web.tsx` ไม่ถูก resolve ตอน build เนทีฟ
 */
const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export function TrackingMap({ height }: { height: number }) {
  const { primitives: p } = useTheme();
  const host = useRef<View>(null);

  useEffect(() => {
    // react-native-web เรนเดอร์ View เป็น div จริง ๆ — ref จึงเป็น element ที่ maplibre ใช้ได้
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return undefined;

    const map = new maplibregl.Map({
      container: el,
      style: MAP_STYLE_URL,
      center: [100.5435, 13.7805],
      zoom: 13,
      attributionControl: { compact: true },
    });

    return () => map.remove();
  }, []);

  return (
    <View
      testID="tracking-map"
      ref={host}
      style={{ height, borderRadius: p.radius.xl, overflow: 'hidden' }}
    />
  );
}
