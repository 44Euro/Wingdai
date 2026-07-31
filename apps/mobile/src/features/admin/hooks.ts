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
