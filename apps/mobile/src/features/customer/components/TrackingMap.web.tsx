import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type maplibregl from 'maplibre-gl';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { MAP_STYLE, FALLBACK_CENTER, boundsOf } from './mapStyle';
import type { TrackingMapProps } from './TrackingMap';

/**
 * แผนที่ของจอติดตาม ฉบับ เว็บ Metro หยิบไฟล์ `.web.tsx` แทน `TrackingMap.tsx` ให้เอง
 *
 * maplibre โหลดตอนที่จอนี้ถูกเปิดเท่านั้น ไม่ผูกไว้กับบันเดิลก้อนแรก
 * มันเป็นไลบรารีก้อนใหญ่ที่สุดในแอป และคนส่วนใหญ่เปิดแอปมาโดยไม่ได้เข้าจอแผนที่เลย
 */
export function TrackingMap({
  height,
  restaurant = null,
  dropoff = null,
  rider = null,
  route = null,
}: TrackingMapProps) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const host = useRef<View>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const riderMarker = useRef<maplibregl.Marker | null>(null);
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
          zoom: 13,
          attributionControl: { compact: true },
        });
        map.current = m;
        setReady(true);
      } catch {
        /**
         * เครื่องที่เปิด WebGL ไม่ได้จะโยนตั้งแต่สร้างแผนที่ ปล่อยให้หลุดขึ้นไปคือจอขาวทั้งแอป
         * แผนที่เป็นของประกอบ ที่อยู่กับสถานะออเดอร์อยู่บนจอเดียวกันอยู่แล้ว
         */
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      riderMarker.current = null;
    };
  }, []);

  /** เส้นทางกับหมุดปลายทั้งสองเปลี่ยนครั้งเดียวต่อออเดอร์ วาดใหม่ทั้งชุดได้ ไม่แพง */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return undefined;

    const draw = () => {
      if (route) {
        const data: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: route.coordinates },
        };
        const existing = m.getSource('delivery-route') as maplibregl.GeoJSONSource | undefined;
        if (existing) existing.setData(data);
        else {
          m.addSource('delivery-route', { type: 'geojson', data });
          m.addLayer({
            id: 'delivery-route-line',
            type: 'line',
            source: 'delivery-route',
            paint: { 'line-color': tokens.tealSolid, 'line-width': 5 },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          });
        }
      }

      const bounds = boundsOf([restaurant, dropoff, rider].filter((x) => x !== null));
      if (bounds) m.fitBounds(bounds, { padding: 40, animate: false });
    };

    if (m.isStyleLoaded()) draw();
    else m.once('load', draw);
    return undefined;
  }, [ready, route, restaurant, dropoff, rider, tokens.tealSolid]);

  /** หมุดไรเดอร์ขยับบ่อยกว่าตัวอื่น ย้ายหมุดเดิม ไม่สร้างใหม่ทุกครั้ง */
  useEffect(() => {
    const m = map.current;
    const mod = lib.current;
    if (!m || !mod || !ready) return undefined;

    if (!rider) {
      riderMarker.current?.remove();
      riderMarker.current = null;
      return undefined;
    }
    if (!riderMarker.current) {
      riderMarker.current = new mod.Marker({ color: tokens.brandAccent }).addTo(m);
    }
    riderMarker.current.setLngLat([rider.lng, rider.lat]);
    return undefined;
  }, [ready, rider, tokens.brandAccent]);

  if (failed) {
    return (
      <View
        testID="tracking-map-unavailable"
        style={{
          height,
          borderRadius: p.radius.xl,
          backgroundColor: tokens.bgSunken,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
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
      testID="tracking-map"
      ref={host}
      style={{
        height,
        borderRadius: p.radius.xl,
        overflow: 'hidden',
        backgroundColor: tokens.bgSunken,
      }}
    />
  );
}
