import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type maplibregl from 'maplibre-gl';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { MAP_STYLE, FALLBACK_CENTER, boundsOf } from '../../customer/components/mapStyle';
import type { OpsMapViewProps } from './OpsMapView';

/** แผนที่ AD8 ฉบับเว็บ Metro หยิบไฟล์ .web.tsx แทน OpsMapView.tsx ให้เอง */
export function OpsMapView({ riders, orders }: OpsMapViewProps) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const host = useRef<View>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const lib = useRef<typeof maplibregl | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [{ default: mod }] = await Promise.all([
          import('maplibre-gl'),
          // CSS ของ maplibre-gl ไม่ใส่แล้วชั้น canvas กับปุ่มซูมจะวางผิดตำแหน่ง
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        if (cancelled) return;

        // react-native-web เรนเดอร์ View เป็น div จริง ๆ ref จึงเป็น element ที่ maplibre ใช้ได้
        const el = host.current as unknown as HTMLElement | null;
        if (!el) return;

        lib.current = mod;
        const m = new mod.Map({
          container: el,
          style: MAP_STYLE as maplibregl.StyleSpecification,
          center: FALLBACK_CENTER,
          zoom: 12,
          attributionControl: { compact: true },
        });
        map.current = m;
        setReady(true);
      } catch {
        // เครื่องที่เปิด WebGL ไม่ได้จะโยนตั้งแต่สร้างแผนที่ ปล่อยหลุดขึ้นไปคือจอขาวทั้งแอป
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current = [];
    };
  }, []);

  /** หมุดทั้งกระดานเปลี่ยนพร้อมกันทุกรอบที่ข้อมูลมา วาดใหม่ทั้งชุดง่ายกว่าไล่เทียบทีละอัน */
  useEffect(() => {
    const m = map.current;
    const mod = lib.current;
    if (!m || !mod || !ready) return undefined;

    for (const marker of markers.current) marker.remove();
    markers.current = [];

    for (const o of orders) {
      markers.current.push(
        new mod.Marker({ element: dot(o.hasRider ? tokens.tealSolid : tokens.danger) })
          .setLngLat([o.lng, o.lat])
          .addTo(m),
      );
    }
    for (const r of riders) {
      markers.current.push(
        new mod.Marker({ element: dot(tokens.brandAccent, 20, r.busy) })
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
  }, [ready, riders, orders, tokens.tealSolid, tokens.danger, tokens.brandAccent]);

  if (failed) {
    return (
      <View
        testID="admin-ops-map-unavailable"
        style={{
          flex: 1,
          backgroundColor: tokens.bgSunken,
          alignItems: 'center',
          justifyContent: 'center',
          gap: p.space.sm,
        }}
      >
        <Icon name="mapPin" size={26} color={tokens.textFaint} />
        <Text variant="small" color="muted">{t('customer.tracking.mapUnavailable')}</Text>
      </View>
    );
  }

  return (
    <View
      testID="admin-ops-map"
      ref={host}
      style={{ flex: 1, backgroundColor: tokens.bgSunken }}
    />
  );
}

function dot(color: string, size = 16, ring = false) {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${color};border:${ring ? 4 : 3}px solid #FFFFFF;box-sizing:border-box`;
  return el;
}
