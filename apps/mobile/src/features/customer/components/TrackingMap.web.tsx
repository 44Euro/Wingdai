import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
// CSS ของ maplibre-gl ไม่ใส่แล้วชั้น canvas กับปุ่มซูมจะวางผิดตำแหน่ง
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../../../theme/ThemeProvider';
import { MAP_STYLE, FALLBACK_CENTER, boundsOf } from './mapStyle';
import type { TrackingMapProps } from './TrackingMap';

/** แผนที่ของจอติดตาม ฉบับ เว็บ Metro หยิบไฟล์ `.web.tsx` แทน `TrackingMap.tsx` ให้เอง */
export function TrackingMap({
  height,
  restaurant = null,
  dropoff = null,
  rider = null,
  route = null,
}: TrackingMapProps) {
  const { tokens, primitives: p } = useTheme();
  const host = useRef<View>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const riderMarker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    // react-native-web เรนเดอร์ View เป็น div จริง ๆ ref จึงเป็น element ที่ maplibre ใช้ได้
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return undefined;

    const m = new maplibregl.Map({
      container: el,
      style: MAP_STYLE as maplibregl.StyleSpecification,
      center: FALLBACK_CENTER,
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
      riderMarker.current = null;
    };
  }, []);

  /** เส้นทางกับหมุดปลายทั้งสองเปลี่ยนครั้งเดียวต่อออร์เดอร์ วาดใหม่ทั้งชุดได้ ไม่แพง */
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;

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
  }, [route, restaurant, dropoff, rider, tokens.tealSolid]);

  /** หมุดไรเดอร์ขยับบ่อยกว่าตัวอื่น ย้ายหมุดเดิม ไม่สร้างใหม่ทุกครั้ง */
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;

    if (!rider) {
      riderMarker.current?.remove();
      riderMarker.current = null;
      return undefined;
    }
    if (!riderMarker.current) {
      riderMarker.current = new maplibregl.Marker({ color: tokens.brandAccent }).addTo(m);
    }
    riderMarker.current.setLngLat([rider.lng, rider.lat]);
    return undefined;
  }, [rider, tokens.brandAccent]);

  return (
    <View
      testID="tracking-map"
      ref={host}
      style={{ height, borderRadius: p.radius.xl, overflow: 'hidden' }}
    />
  );
}
