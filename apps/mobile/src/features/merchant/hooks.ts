import { useEffect, useState } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { repos } from '../../data';
import type { NewMenuItemInput } from '../../data/repositories';
import type { OrderStatus } from '../../data/types';

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

/**
 * คิวออร์เดอร์ของร้าน
 *
 * ดึงซ้ำทุก 10 วินาที เพราะยังไม่มี WebSocket (claude.md §5 บอกว่าตำแหน่งไรเดอร์ต้อง push
 * แต่คิวร้านไม่ได้ต้องการความถี่ระดับนั้น) — ครัวรู้ตัวช้าสุด 10 วินาทีถือว่ารับได้
 * เทียบกับหน้าต่างตอบรับ 60 วินาที และ **ต้องเปลี่ยนเป็น push ก่อนขึ้นของจริง**
 * ไม่งั้นร้านที่เปิดแอปค้างไว้ทั้งวันจะยิงคำขอเปล่า ๆ วันละหลายพันครั้ง
 */
export function useMerchantOrders(scope: 'queue' | 'history' = 'queue') {
  return useQuery({
    queryKey: ['merchant', 'orders', scope],
    queryFn: () => repos.merchant.listOrders({ scope }),
    refetchInterval: scope === 'queue' ? 10_000 : false,
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

/**
 * ร้านเปลี่ยนสถานะออร์เดอร์ — รับ / กำลังทำ / ปฏิเสธ
 * เซิร์ฟเวอร์เป็นคนตัดสินว่าทำได้ไหม (services/core-api/src/orders/authorize.ts) ที่นี่แค่เรียก
 */
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      repos.orders.updateStatus(orderId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant', 'orders'] }),
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

/**
 * เวลาปัจจุบันที่ขยับทุกวินาที — ใช้ขับนาฬิกานับถอยหลังในจอคิว
 *
 * เก็บเป็น state ตัวเดียวที่จอแม่ แล้วส่งลงการ์ดทุกใบ ไม่ใช่ให้แต่ละการ์ดตั้ง interval เอง
 * คิวช่วงพีค 30 ใบ = 30 timer ที่ปลุก JS thread คนละจังหวะ ซึ่งจอนี้ห้ามกระตุก (claude.md §10)
 */
export function useTicker(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
