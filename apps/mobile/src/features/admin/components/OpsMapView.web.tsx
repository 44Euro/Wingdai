import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
// CSS ของ maplibre-gl ไม่ใส่แล้วชั้น canvas กับปุ่มซูมจะวางผิดตำแหน่ง
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../../../theme/ThemeProvider';
import { MAP_STYLE, FALLBACK_CENTER, boundsOf } from '../../customer/components/mapStyle';
import type { OpsMapViewProps } from './OpsMapView';

/** แผนที่ AD8 ฉบับเว็บ Metro หยิบไฟล์ .web.tsx แทน OpsMapView.tsx ให้เอง */
export function OpsMapView({ riders, orders }: OpsMapViewProps) {
  const { tokens } = useTheme();
  const host = useRef<View>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    // react-native-web เรนเดอร์ View เป็น div จริง ๆ ref จึงเป็น element ที่ maplibre ใช้ได้
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return undefined;

    const m = new maplibregl.Map({
      container: el,
      style: MAP_STYLE as maplibregl.StyleSpecification,
      center: FALLBACK_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
    });
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
      markers.current = [];
    };
  }, []);

  /** หมุดทั้งกระดานเปลี่ยนพร้อมกันทุกรอบที่ข้อมูลมา วาดใหม่ทั้งชุดง่ายกว่าไล่เทียบทีละอัน */
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;

    for (const marker of markers.current) marker.remove();
    markers.current = [];

    for (const o of orders) {
      markers.current.push(
        new maplibregl.Marker({ element: dot(o.hasRider ? tokens.tealSolid : tokens.danger) })
          .setLngLat([o.lng, o.lat])
          .addTo(m),
      );
    }
    for (const r of riders) {
      markers.current.push(
        new maplibregl.Marker({ element: dot(tokens.brandAccent, 20, r.busy) })
          .setLngLat([r.lng, r.lat])
          .addTo(m),
      );
    }

    const bounds = boundsOf([
      ...riders.map((r) => ({ lat: r.lat, lng: r.lng })),
      ...orders.map((o) => ({ lat: o.lat, lng: o.lng })),
    ]);
    if (bounds) m.fitBounds(bounds, { padding: 40, animate: false });
    return undefined;
  }, [riders, orders, tokens.tealSolid, tokens.danger, tokens.brandAccent]);

  return <View testID="admin-ops-map" ref={host} style={{ flex: 1 }} />;
}

function dot(color: string, size = 16, ring = false) {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${color};border:${ring ? 4 : 3}px solid #FFFFFF;box-sizing:border-box`;
  return el;
}
