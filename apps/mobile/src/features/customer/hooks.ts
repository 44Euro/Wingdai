import { useQuery, useMutation } from '@tanstack/react-query';
import { repos } from '../../data';
import { useAuthStore } from '../auth/authStore';
import type { Restaurant } from '../../data/types';
import type { CreateOrderInput } from '../../data/repositories';

/** กรองเฉพาะร้านที่อนุมัติแล้ว — ลูกค้าไม่ควรเห็นร้านที่ยังรออนุมัติ (แยกเป็น pure fn เพื่อทดสอบ) */
export function filterApproved(list: Restaurant[]): Restaurant[] {
  return list.filter((r) => r.isApproved);
}

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => filterApproved(await repos.catalog.listRestaurants()),
  });
}

export function useRestaurant(id: string) {
  return useQuery({ queryKey: ['restaurant', id], queryFn: () => repos.catalog.getRestaurant(id) });
}

export function useMenu(restaurantId: string) {
  return useQuery({ queryKey: ['menu', restaurantId], queryFn: () => repos.catalog.getMenu(restaurantId) });
}

export function useCreateOrder() {
  return useMutation({ mutationFn: (input: CreateOrderInput) => repos.orders.create(input) });
}

export function useCustomerOrders() {
  const accountId = useAuthStore((s) => s.account?.id);
  return useQuery({
    queryKey: ['orders', accountId],
    queryFn: () => (accountId ? repos.orders.listForCustomer(accountId) : Promise.resolve([])),
    enabled: !!accountId,
  });
}
