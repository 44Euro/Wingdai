import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type { OrderStatus } from '../../data/types';

/**
 * สถานะไรเดอร์ + งานที่ถูกเสนอ
 *
 * ดึงซ้ำทุก 4 วินาทีตอนออนไลน์ เพราะข้อเสนอมีอายุ 15 วินาที (claude.md §6.3)
 * ถ้าถี่กว่านี้ก็เปลืองเปล่า ถ้าห่างกว่านี้ไรเดอร์จะเสียเวลาไปกับข้อเสนอเกินครึ่ง
 *
 * **ต้องเปลี่ยนเป็น WebSocket ก่อนขึ้นของจริง** — §5 บอกไว้ตรง ๆ ว่าห้าม polling
 * สำหรับข้อมูล realtime และไรเดอร์เปิดแอปค้างทั้งวัน วันละหลายหมื่นคำขอต่อคน
 */
export function useRiderStatus(pollWhileOnline = true) {
  return useQuery({
    queryKey: ['rider', 'status'],
    queryFn: () => repos.rider.status(),
    refetchInterval: (q) =>
      pollWhileOnline && q.state.data?.isOnline ? 4_000 : false,
  });
}

export function useSetRiderOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ isOnline, at }: { isOnline: boolean; at?: { lat: number; lng: number } }) =>
      repos.rider.setOnline(isOnline, at),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider'] }),
  });
}

export function useRespondToOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, accept }: { orderId: string; accept: boolean }) => {
      if (accept) await repos.rider.acceptOffer(orderId);
      else await repos.rider.declineOffer(orderId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider'] }),
  });
}

/** ไรเดอร์กดรับของ / ส่งถึง — เซิร์ฟเวอร์เป็นคนตัดสินสิทธิ์ (orders/authorize.ts) */
export function useAdvanceJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      repos.orders.updateStatus(orderId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider'] }),
  });
}

export function useRiderStats() {
  return useQuery({ queryKey: ['rider', 'stats'], queryFn: () => repos.rider.stats() });
}
