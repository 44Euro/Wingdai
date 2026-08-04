/** แหล่ง tile ของแผนที่ OpenStreetMap raster */
export const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

/** กึ่งกลางย่านอารีย์ ใช้เมื่อยังไม่รู้พิกัดอะไรเลย */
export const FALLBACK_CENTER: [number, number] = [100.5435, 13.7805];

/** กรอบที่ครอบทุกจุดพอดี บวกขอบกันหมุดติดขอบจอ */
export function boundsOf(
  points: { lat: number; lng: number }[],
  padDegrees = 0.002,
): [number, number, number, number] | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    Math.min(...lngs) - padDegrees,
    Math.min(...lats) - padDegrees,
    Math.max(...lngs) + padDegrees,
    Math.max(...lats) + padDegrees,
  ];
}
