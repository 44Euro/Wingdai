import { useEffect, useState } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { repos } from '../../data';
import type { NewMenuItemInput } from '../../data/repositories';
import type { CancelReason, OrderStatus, WeeklyHours } from '../../data/types';

/** id ร้านที่บัญชีนี้เป็นเจ้าของและอนุมัติแล้ว (โหมดร้านค้า) */
export function useOwnerRestaurantId(): string | null {
  const account = useAuthStore((s) => s.account);
  const restaurants = useAuthStore((s) => s.restaurants);
  if (!account) return null;
  return restaurants.find((r) => r.ownerUserId === account.id && r.isApproved)?.id ?? null;
}

export function useCreateMenuItem(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewMenuItemInput) => repos.catalog.createMenuItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu', restaurantId] }),
  });
}

export function useMyRestaurants() {
  return useQuery({
    queryKey: ['merchant', 'restaurants'],
    queryFn: () => repos.merchant.myRestaurants(),
  });
}

/** คิวออร์เดอร์ของร้าน */
export function useMerchantOrders(scope: 'queue' | 'history' = 'queue') {
  return useQuery({
    queryKey: ['merchant', 'orders', scope],
    queryFn: () => repos.merchant.listOrders({ scope }),
    refetchInterval: scope === 'queue' ? 10_000 : false,
  });
}

/** ยอดขายวันนี้ / 7 วัน (M1 M5) */
export function useMerchantSummary(restaurantId?: string) {
  return useQuery({
    queryKey: ['merchant', 'summary', restaurantId ?? 'all'],
    queryFn: () => repos.merchant.summary(restaurantId),
    refetchInterval: 30_000,
  });
}

export function useSetRestaurantOpen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, isOpen }: { restaurantId: string; isOpen: boolean }) =>
      repos.merchant.setOpen(restaurantId, isOpen),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant', 'restaurants'] }),
  });
}

/** ตั้งตารางเวลาและพักรับออร์เดอร์ (design M11) */
function useRestaurantSettingMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant', 'restaurants'] });
      qc.invalidateQueries({ queryKey: ['restaurants'] });
      qc.invalidateQueries({ queryKey: ['restaurant'] });
    },
  });
}

export function useSetRestaurantHours() {
  return useRestaurantSettingMutation(
    ({ restaurantId, hours }: { restaurantId: string; hours: WeeklyHours }) =>
      repos.merchant.setHours(restaurantId, hours),
  );
}

export function usePauseRestaurant() {
  return useRestaurantSettingMutation(
    ({ restaurantId, minutes }: { restaurantId: string; minutes: number }) =>
      repos.merchant.pause(restaurantId, minutes),
  );
}

/** ร้านเปลี่ยนสถานะออร์เดอร์ รับ / กำลังทำ / ปฏิเสธ */
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, reason }: {
      orderId: string; status: OrderStatus; reason?: CancelReason;
    }) => repos.orders.updateStatus(orderId, status, reason ? { reason } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant', 'orders'] });
      // ลูกค้าที่เปิดจอติดตามค้างไว้ต้องเห็นว่าใบถูกปฏิเสธ ไม่ใช่เห็น "กำลังรอร้านรับ" ต่อไป
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/** แก้เมนูทั้งจาน (design M13) ต่างจาก `useToggleMenuItem` ที่แตะแค่ช่อง "มีขาย" */
export function useUpdateMenuItem(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ menuItemId, patch }: {
      menuItemId: string;
      patch: { name?: string; description?: string; price?: number; isAvailable?: boolean };
    }) => repos.merchant.updateMenuItem(menuItemId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu', restaurantId] }),
  });
}

export function useToggleMenuItem(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ menuItemId, isAvailable }: { menuItemId: string; isAvailable: boolean }) =>
      repos.merchant.updateMenuItem(menuItemId, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu', restaurantId] }),
  });
}

/** เวลาปัจจุบันที่ขยับทุกวินาที ใช้ขับนาฬิกานับถอยหลังในจอคิว */
export function useTicker(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
