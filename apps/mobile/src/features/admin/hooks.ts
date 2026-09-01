import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type { RefundFault, AdminOrderFilter } from '../../data/types';

/** จอ exception-based (§7) ดึงซ้ำทุกครึ่งนาที ของที่ค้างเป็นนาที ไม่ใช่เป็นวินาที */
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

/** §6.4 จุดที่คนกดยืนยันก่อนเงินออก */
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

/** R9 เคลียร์เรื่องที่ไรเดอร์แจ้งแล้วจัดการเสร็จ ไม่แตะสถานะออเดอร์ */
export function useResolveRiderIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => repos.admin.resolveRiderIssue(issueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'exceptions'] }),
  });
}

/** คิวอนุมัติร้าน (§4.3 §7) */
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

/** อนุมัติ/ปฏิเสธไรเดอร์ ปฏิเสธต้องมีเหตุผลเสมอ */
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

/** บันทึกว่าไรเดอร์นำเงินสดมาส่งแล้ว */
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

/** คำขอถอนของไรเดอร์ที่รอตัดสิน (design R12) */
export function useRiderPayouts() {
  return useQuery({
    queryKey: ['admin', 'rider-payouts'],
    queryFn: () => repos.admin.riderPayouts(),
  });
}

/** ยืนยัน/ปฏิเสธคำขอถอน */
export function useDecideRiderPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, ...input }: {
      payoutId: string; approve: boolean; rejectionReason?: string;
    }) => repos.admin.decideRiderPayout(payoutId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['rider'] });
    },
  });
}

/** คำขอถอนของร้านที่รอตัดสิน (product-spec §6.2) */
export function useMerchantPayouts() {
  return useQuery({
    queryKey: ['admin', 'merchant-payouts'],
    queryFn: () => repos.admin.merchantPayouts(),
  });
}

export function useDecideMerchantPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, ...input }: {
      payoutId: string; approve: boolean; rejectionReason?: string;
    }) => repos.admin.decideMerchantPayout(payoutId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['merchant'] });
    },
  });
}

/** จอเฝ้าออเดอร์ (design AD2) ตัวกรองอยู่ใน key เพื่อให้แต่ละชิปมี cache ของตัวเอง */
export function useAdminOrders(filter: AdminOrderFilter) {
  return useQuery({
    queryKey: ['admin', 'orders', filter],
    queryFn: () => repos.admin.orders(filter),
    refetchInterval: 30_000,
  });
}

/** ตัวเลขสด AD1 ถี่กว่าตัวเลขย้อนหลัง เพราะทั้งหน้าจอนี้คือคำว่า "ตอนนี้" */
export function useLiveOps() {
  return useQuery({
    queryKey: ['admin', 'live'],
    queryFn: () => repos.admin.liveOps(),
    refetchInterval: 15_000,
  });
}

export function useRestaurantPayables() {
  return useQuery({
    queryKey: ['admin', 'payables'],
    queryFn: () => repos.admin.restaurantPayables(),
  });
}

/** §2 ยังห้ามรอบจ่ายอัตโนมัติ จ่ายทีละร้าน แอดมินกดยืนยันเอง */
export function useSettleRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (restaurantId: string) => repos.admin.settleRestaurant(restaurantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useOpsMap() {
  return useQuery({
    queryKey: ['admin', 'ops-map'],
    queryFn: () => repos.admin.opsMap(),
    refetchInterval: 15_000,
  });
}

/** เอกสาร KYC พร้อมลิงก์ดูรูป (design AD6) */
export function useRiderDocuments(accountId: string) {
  return useQuery({
    queryKey: ['admin', 'rider-docs', accountId],
    queryFn: () => repos.admin.riderDocuments(accountId),
  });
}

/** ตรวจเอกสารทีละใบ ปฏิเสธต้องมีเหตุผลเสมอ (กฎเดิมจาก R8) */
export function useDecideRiderDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId, kind, approve, rejectionReason,
    }: {
      accountId: string;
      kind: Parameters<typeof repos.admin.decideRiderDocument>[1];
      approve: boolean;
      rejectionReason?: string;
    }) => repos.admin.decideRiderDocument(accountId, kind, { approve, rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['rider'] });
    },
  });
}
