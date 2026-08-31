import React from 'react';
import { View } from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { MAP_STYLE, FALLBACK_CENTER, boundsOf } from '../../customer/components/mapStyle';
import type { OpsMapData } from '../../../data/types';

export type OpsMapViewProps = OpsMapData;

// แยกแผนที่ออกจากจอ AD8 เพราะ maplibre ฝั่งเนทีฟเรียก codegenNativeComponent ซึ่งไม่มีบนเว็บ
export function OpsMapView({ riders, orders }: OpsMapViewProps) {
  const { tokens } = useTheme();
  const bounds = boundsOf([
    ...riders.map((r) => ({ lat: r.lat, lng: r.lng })),
    ...orders.map((o) => ({ lat: o.lat, lng: o.lng })),
  ]);

  return (
    <Map style={{ flex: 1 }} mapStyle={MAP_STYLE}>
      {/* ไม่มีหมุดสักอันก็ยังต้องขึ้นแผนที่ ไม่ใช่จอขาว ใช้จุดตั้งต้นของโซนแรก */}
      <Camera initialViewState={bounds ? { bounds } : { center: FALLBACK_CENTER, zoom: 12 }} />

      {orders.map((o) => (
        <Marker key={o.id} id={`ops-order-${o.id}`} lngLat={[o.lng, o.lat]}>
          {/* ใบที่ยังไม่มีไรเดอร์เป็นสีเตือน เป็นสิ่งเดียวบนแผนที่ที่ต้องลงมือ */}
          <Dot color={o.hasRider ? tokens.tealSolid : tokens.danger} />
        </Marker>
      ))}

      {riders.map((r) => (
        <Marker key={r.accountId} id={`ops-rider-${r.accountId}`} lngLat={[r.lng, r.lat]}>
          <Dot color={tokens.brandAccent} size={20} ring={r.busy} />
        </Marker>
      ))}
    </Map>
  );
}

/** หมุดวงกลมขอบขาว อ่านออกทั้งบนถนนสีอ่อนและสวนสีเข้ม (ทรงเดียวกับจอติดตาม) */
function Dot({ color, size = 16, ring = false }: { color: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: ring ? 4 : 3,
        borderColor: '#FFFFFF',
      }}
    />
  );
}
