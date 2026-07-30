import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

export class LocationDenied extends Error {
  constructor() {
    super('ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง');
    this.name = 'LocationDenied';
  }
}

/**
 * ตำแหน่งปัจจุบันของเครื่อง — ห่อ expo-location ไว้ที่ไฟล์นี้ไฟล์เดียว
 * จอที่เรียกใช้จึงไม่ผูกกับไลบรารี และ mock ในเทสต์ได้ที่จุดเดียว (แบบเดียวกับ TrackingMap)
 *
 * **ขอสิทธิ์แบบ foreground เท่านั้น** — claude.md §4.3 บอกว่าตำแหน่งเบื้องหลัง
 * เป็นของบทบาทไรเดอร์ตอนทำงานอย่างเดียว ห้ามขอจากบัญชีลูกค้าเด็ดขาด
 * ตรงนี้เป็นแค่การจับพิกัดครั้งเดียวตอนบันทึกที่อยู่ ไม่ได้ตามตำแหน่งต่อเนื่อง
 */
export async function getCurrentCoords(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new LocationDenied();

  /*
   * Balanced พอสำหรับที่อยู่บ้าน (คลาดเคลื่อนหลักสิบเมตร) และเปลืองแบตน้อยกว่า High มาก
   * ความแม่นระดับเมตรไม่ช่วยอะไร เพราะไรเดอร์อ่านข้อความที่อยู่เป็นหลักอยู่ดี
   */
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
