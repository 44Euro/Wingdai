import React from 'react';
import { View } from 'react-native';
import { Map, Camera, GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { MAP_STYLE, FALLBACK_CENTER, boundsOf } from './mapStyle';
import type { LatLng, DeliveryRoute } from '../../../lib/route';

export interface TrackingMapProps {
  height: number;
  /** จุดรับอาหาร null = ยังไม่รู้ */
  restaurant?: LatLng | null;
  dropoff?: LatLng | null;
  /** ตำแหน่งไรเดอร์ที่ผ่าน interpolation มาแล้ว null = ยังไม่มีไรเดอร์ */
  rider?: LatLng | null;
  route?: DeliveryRoute | null;
}

/** แผนที่ของจอติดตาม ห่อ MapLibre ไว้ที่ไฟล์นี้ไฟล์เดียว */
export function TrackingMap({
  height,
  restaurant = null,
  dropoff = null,
  rider = null,
  route = null,
}: TrackingMapProps) {
  const { tokens, primitives: p } = useTheme();
  const points = [restaurant, dropoff, rider].filter((x): x is LatLng => x !== null);
  const bounds = boundsOf(points);

  return (
    <View testID="tracking-map" style={{ height, borderRadius: p.radius.xl, overflow: 'hidden' }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE}>
        <Camera
          initialViewState={
            bounds
              ? { bounds }
              : { center: FALLBACK_CENTER, zoom: 13 }
          }
        />

        {route ? (
          <GeoJSONSource
            id="delivery-route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route.coordinates },
            }}
          >
            <Layer
              id="delivery-route-line"
              type="line"
              paint={{ 'line-color': tokens.tealSolid, 'line-width': 5 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}

        {restaurant ? (
          <Marker id="pin-restaurant" lngLat={[restaurant.lng, restaurant.lat]}>
            <Dot color={tokens.brandAccent} />
          </Marker>
        ) : null}

        {dropoff ? (
          <Marker id="pin-dropoff" lngLat={[dropoff.lng, dropoff.lat]}>
            <Dot color={tokens.tealSolid} />
          </Marker>
        ) : null}

        {rider ? (
          <Marker id="pin-rider" lngLat={[rider.lng, rider.lat]}>
            <Dot color={tokens.brandAccent} size={22} ring />
          </Marker>
        ) : null}
      </Map>
    </View>
  );
}

/** หมุดวงกลมขอบขาว อ่านออกทั้งบนถนนสีอ่อนและสวนสีเข้ม */
function Dot({ color, size = 16, ring = false }: { color: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: ring ? 4 : 3,
        // ค่าดิบโดยตั้งใจ: หมุดวางบนไทล์แผนที่ ไม่ใช่บนพื้นของแอป (ดูเหตุผลเดียวกันใน OpsMapView)
        borderColor: '#FFFFFF',
      }}
    />
  );
}
