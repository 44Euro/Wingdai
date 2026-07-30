import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

export class LocationDenied extends Error {
  constructor() {
    super('ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง');
    this.name = 'LocationDenied';
  }
}

/** ตำแหน่งปัจจุบันของเครื่อง ห่อ expo-location ไว้ที่ไฟล์นี้ไฟล์เดียว */
export async function getCurrentCoords(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new LocationDenied();

  /** Balanced พอสำหรับที่อยู่บ้าน (คลาดเคลื่อนหลักสิบเมตร) และเปลืองแบตน้อยกว่า High มาก */
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
