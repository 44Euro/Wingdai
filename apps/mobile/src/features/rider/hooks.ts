import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type {
  OrderStatus, EarningsPeriod, RiderIssueKind, RiderDocumentKind,
} from '../../data/types';

/** สถานะไรเดอร์ + งานที่ถูกเสนอ */
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

/** ไรเดอร์กดรับของ / ส่งถึง เซิร์ฟเวอร์เป็นคนตัดสินสิทธิ์ (orders/authorize.ts) */
export function useAdvanceJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId, status, proof,
    }: {
      orderId: string;
      status: OrderStatus;
      /** R11 ปิดงานต้องมีรหัสยืนยันจากลูกค้า เซิร์ฟเวอร์เป็นคนตรวจ */
      proof?: { deliveryPin?: string; photoPath?: string };
    }) => repos.orders.updateStatus(orderId, status, proof),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider'] }),
  });
}

/** แจ้งปัญหาระหว่างส่ง (design R9) */
export function useReportIssue() {
  return useMutation({
    mutationFn: (input: { orderId: string; kind: RiderIssueKind; detail?: string }) =>
      repos.rider.reportIssue(input),
  });
}

/** เอกสารของไรเดอร์ (R8) คืนครบทุกชนิดเสมอ ชนิดที่ยังไม่ส่งได้ `missing` */
export function useRiderDocuments() {
  return useQuery({
    queryKey: ['rider', 'documents'],
    queryFn: () => repos.rider.documents(),
  });
}

/** อัปโหลดเอกสารหนึ่งชนิด */
export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, file }: { kind: RiderDocumentKind; file: { uri: string; ext: string } }) =>
      repos.rider.uploadDocument(kind, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider', 'documents'] }),
  });
}

/** อัปโหลดรูปยืนยันส่ง (R11) คืนเส้นทางในบักเก็ตปิด */
export function useUploadDeliveryPhoto() {
  return useMutation({
    mutationFn: ({ orderId, file }: { orderId: string; file: { uri: string; ext: string } }) =>
      repos.rider.uploadDeliveryPhoto(orderId, file),
  });
}

export function useRiderStats() {
  return useQuery({ queryKey: ['rider', 'stats'], queryFn: () => repos.rider.stats() });
}

/** จอรายได้ + ประวัติงาน (R4 R6) ตัวเลขย้อนหลัง ไม่ต้องดึงซ้ำถี่เหมือนจอรับงาน */
export function useRiderEarnings(period: EarningsPeriod = 'week') {
  return useQuery({
    queryKey: ['rider', 'earnings', period],
    queryFn: () => repos.rider.earnings(period),
    placeholderData: (prev) => prev,
  });
}

/** ยอดเงินของไรเดอร์ (R12) */
export function useRiderBalance() {
  return useQuery({ queryKey: ['rider', 'balance'], queryFn: () => repos.rider.balance() });
}

/** ขอถอนเงิน สำเร็จแล้วต้องล้างแคชยอด ไม่งั้นจอยังโชว์ปุ่มถอนทั้งที่มีคำขอค้างแล้ว */
export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountSatang: number) => repos.rider.requestPayout(amountSatang),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider'] }),
  });
}

/** จุดตั้งทำงาน (R7) null = ยังไม่ปักหมุด รับงานได้ทุกที่ */
export function useWorkBase() {
  return useQuery({ queryKey: ['rider', 'workBase'], queryFn: () => repos.rider.workBase() });
}

export function useSetWorkBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { lat: number; lng: number; radiusKm: number }) =>
      repos.rider.setWorkBase(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider'] }),
  });
}
