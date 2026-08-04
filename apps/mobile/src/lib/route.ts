import type { LatLng } from './geo';

export type { LatLng };

/** เส้นทางส่งจริงตามถนน */
export interface DeliveryRoute {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
}

/** ตำแหน่งไรเดอร์อัปเดตนาทีละครั้ง (ตัดสินใจไว้ 2026-08-03) */
export const PING_INTERVAL_MS = 60_000;

/** ตำแหน่งระหว่าง `a` กับ `b` ที่สัดส่วน `t` (0–1) นอกช่วงถูกบีบเข้าช่วงเสมอ */
export function interpolatePosition(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.min(1, Math.max(0, t));
  return {
    lat: a.lat + (b.lat - a.lat) * k,
    lng: a.lng + (b.lng - a.lng) * k,
  };
}

/** ผ่านมากี่ส่วนของช่วงอัปเดตแล้ว */
export function progressBetweenPings(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / PING_INTERVAL_MS));
}

/** เส้นทางตามถนนจาก OSRM */
export async function fetchRoute(from: LatLng, to: LatLng): Promise<DeliveryRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/`
    + `${from.lng},${from.lat};${to.lng},${to.lat}`
    + `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const body = (await res.json()) as {
      routes?: {
        geometry?: { coordinates?: [number, number][] };
        distance?: number;
        duration?: number;
      }[];
    };

    const route = body.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;

    return {
      coordinates,
      distanceKm: Number(((route?.distance ?? 0) / 1000).toFixed(1)),
      durationMinutes: Math.round((route?.duration ?? 0) / 60),
    };
  } catch {
    // เน็ตหลุดหรือ OSRM ล่ม แผนที่ยังวาดหมุดได้ แค่ไม่มีเส้นทาง
    return null;
  }
}
