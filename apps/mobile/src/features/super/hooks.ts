import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type { AccountType, FeatureFlagKey, PlatformPricing, ZoneInput } from '../../data/types';

/** ตัวเลข §8 ครบเก้าตัว (design SA1) */
export function useSuperMetrics(days: number) {
  return useQuery({
    queryKey: ['super', 'metrics', days],
    queryFn: () => repos.super.metrics(days),
  });
}

export function useSuperZones() {
  return useQuery({ queryKey: ['super', 'zones'], queryFn: () => repos.super.zones() });
}

export function useSaveZone() {
  const qc = useQueryClient();
  return useMutation({
    // `id` ว่าง = สร้างใหม่ มี id = แก้ของเดิม จอเดียวกันทำทั้งสองอย่าง
    mutationFn: ({ id, input }: { id: string | null; input: ZoneInput }) =>
      (id ? repos.super.updateZone(id, input) : repos.super.createZone(input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super', 'zones'] });
      // จอสมัครไรเดอร์เลือกโซนจากรายการเดียวกัน
      qc.invalidateQueries({ queryKey: ['rider', 'zones'] });
    },
  });
}

export function useAdminAccounts() {
  return useQuery({ queryKey: ['super', 'admins'], queryFn: () => repos.super.admins() });
}

export function useSetAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, role }: { accountId: string; role: AccountType }) =>
      repos.super.setRole(accountId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super'] }),
  });
}

/** SA4 + SA6 อยู่จอเดียวกัน จึงอ่านมาก้อนเดียว */
export function useSuperConfig() {
  return useQuery({ queryKey: ['super', 'config'], queryFn: () => repos.super.config() });
}

/** §6.1 ห้ามให้ค่าคอมเลื่อนเงียบ ๆ จอต้องให้ยืนยันอีกชั้นก่อนเรียกตัวนี้ */
export function useSetPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PlatformPricing, 'updatedAt'>) => repos.super.setPricing(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super'] }),
  });
}

export function useSetFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: FeatureFlagKey; enabled: boolean }) =>
      repos.super.setFlag(key, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super'] });
      // flag คุมช่องทางจ่ายเงินที่ทั้งแอปอ่าน ค้างของเก่าไว้คือโชว์ช่องทางที่เพิ่งปิดไป
      qc.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

/** ประวัติการกระทำ (design SA5) อ่านอย่างเดียว ไม่มี mutation คู่กับมันโดยตั้งใจ */
export function useAuditLog() {
  return useQuery({ queryKey: ['super', 'audit'], queryFn: () => repos.super.audit() });
}
