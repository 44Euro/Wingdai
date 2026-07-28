import React from 'react';
import { View } from 'react-native';
import { Map } from '@maplibre/maplibre-react-native';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * แหล่ง tile ของแผนที่
 *
 * demotiles ของ MapLibre เอง: ฟรี ไม่ต้องมี API key ใช้ได้ทันที
 * แต่เป็นแผนที่โลกความละเอียดต่ำ ไม่มีถนนระดับซอย — **ใช้ได้เฉพาะช่วงพัฒนา**
 *
 * ก่อนเปิดใช้จริงต้องเปลี่ยนเป็น .pmtiles ที่โฮสต์เอง ตาม claude.md §10
 * (เลือก Protomaps มาแต่แรกเพราะไม่มีค่าใช้จ่ายต่อการโหลดแผนที่ 1 ครั้ง ซึ่ง §5 เตือนไว้)
 */
const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/**
 * แผนที่ของจอติดตาม — ห่อ MapLibre ไว้ที่ไฟล์นี้ไฟล์เดียว
 * จอที่เรียกใช้จึงไม่ผูกกับไลบรารีแผนที่ และ mock ในเทสต์ได้ที่จุดเดียว
 *
 * ห้ามใส่ blur ทับแผนที่ตาม claude.md §10 — จอแผนที่ต้องใช้พื้นทึบ
 */
export function TrackingMap({ height }: { height: number }) {
  const { primitives: p } = useTheme();
  return (
    <View testID="tracking-map" style={{ height, borderRadius: p.radius.xl, overflow: 'hidden' }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE_URL} />
    </View>
  );
}
