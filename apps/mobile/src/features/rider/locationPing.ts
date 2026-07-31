import { useEffect, useRef } from 'react';
import { repos } from '../../data';
import { getCurrentCoords } from '../customer/currentLocation';
import type { RiderJob } from '../../data/types';

/** จังหวะส่งพิกัดของไรเดอร์ (product-spec §5) */
export const DELIVERING_INTERVAL_MS = 4_000;
export const IDLE_INTERVAL_MS = 20_000;

/** กำลังไปส่งของอยู่ไหม `picked_up` เท่านั้นที่ลูกค้ากำลังรอดูหมุด */
export function isDelivering(jobs: RiderJob[]): boolean {
  return jobs.some((j) => j.status === 'picked_up');
}

export function pingIntervalFor(jobs: RiderJob[]): number {
  return isDelivering(jobs) ? DELIVERING_INTERVAL_MS : IDLE_INTERVAL_MS;
}

/** ส่งพิกัดเป็นจังหวะระหว่างที่เปิดรับงาน */
export function useLocationPing(isOnline: boolean, jobs: RiderJob[]) {
  const intervalMs = pingIntervalFor(jobs);
  // เก็บไว้ใน ref เพื่อไม่ให้ตัวจับเวลาถูกสร้างใหม่ทุกครั้งที่ jobs เปลี่ยน object identity
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isOnline) return;

    let cancelled = false;

    async function send() {
      // รอบก่อนยังไม่จบ (เน็ตช้า) ข้ามรอบนี้ ดีกว่าคิวซ้อนกันจนส่งพิกัดเก่าตามหลัง
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const at = await getCurrentCoords();
        if (!cancelled) await repos.rider.ping(at.lat, at.lng);
      } catch {
        // เน็ตหลุดหรือ GPS ยังจับไม่ได้ = ข้ามรอบนี้ ไม่ใช่เหตุให้หยุดส่งถาวร
      } finally {
        inFlight.current = false;
      }
    }

    void send();
    const id = setInterval(() => void send(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOnline, intervalMs]);
}
