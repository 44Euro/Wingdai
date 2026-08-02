import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type { RefundFault } from '../../data/types';

/** จอ exception-based (§7) — ดึงซ้ำทุกครึ่งนาที ของที่ค้างเป็นนาที ไม่ใช่เป็นวินาที */
export function useExceptions() {
  return useQuery({
    queryKey: ['admin', 'exceptions'],
    queryFn: () => repos.admin.exceptions(),
    refetchInterval: 30_000,
  });
}

export function useAdminMetrics() {
  return useQuery({ queryKey: ['admin', 'metrics'], queryFn: () => repos.admin.metrics() });
}

export function useOpenRefunds() {
  return useQuery({ queryKey: ['admin', 'refunds'], queryFn: () => repos.admin.openRefunds() });
}

/** §6.4 — จุดที่คนกดยืนยันก่อนเงินออก */
export function useDecideRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId, approve, amountSatang, fault,
    }: { caseId: string; approve: boolean; amountSatang?: number; fault?: RefundFault }) =>
      repos.admin.decideRefund(caseId, { approve, amountSatang, fault }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** §6.3 ทางแทรกมือเมื่อเครื่องจ่ายงานหาไรเดอร์ไม่ได้ */
export function useForceDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => repos.admin.forceDispatch(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'exceptions'] }),
  });
}

/** คิวอนุมัติร้าน (§4.3 · §7) */
export function usePendingRestaurants() {
  return useQuery({
    queryKey: ['admin', 'restaurants'],
    queryFn: () => repos.admin.pendingRestaurants(),
  });
}

export function useDecideRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, approve }: { restaurantId: string; approve: boolean }) =>
      repos.admin.decideRestaurant(restaurantId, approve),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** คิวอนุมัติไรเดอร์ (§7) */
export function usePendingRiders() {
  return useQuery({
    queryKey: ['admin', 'riders'],
    queryFn: () => repos.admin.pendingRiders(),
  });
}

/**
 * อนุมัติ/ปฏิเสธไรเดอร์ — ปฏิเสธต้องมีเหตุผลเสมอ
 * ล้าง ['rider'] ด้วย เพราะจอฝั่งไรเดอร์อ่านสถานะใบสมัครจาก cache ก้อนนั้น
 */
export function useDecideRider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId, approve, rejectionReason,
    }: { accountId: string; approve: boolean; rejectionReason?: string }) =>
      repos.admin.decideRider(accountId, { approve, rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['rider'] });
    },
  });
}

/** ไรเดอร์ที่ยังถือเงินสดของบริษัทอยู่ (§6.2) */
export function useRidersHoldingCash() {
  return useQuery({
    queryKey: ['admin', 'rider-cash'],
    queryFn: () => repos.admin.ridersHoldingCash(),
  });
}

/**
 * บันทึกว่าไรเดอร์นำเงินสดมาส่งแล้ว
 * ล้าง ['rider'] ด้วย เพราะจอไรเดอร์อ่านยอดเงินสดในมือจาก cache ก้อนนั้น
 */
export function useSettleRiderCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, amountSatang }: { accountId: string; amountSatang: number }) =>
      repos.admin.settleRiderCash(accountId, amountSatang),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['rider'] });
    },
  });
}
