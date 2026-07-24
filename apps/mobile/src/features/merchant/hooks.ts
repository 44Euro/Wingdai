import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { repos } from '../../data';
import type { NewMenuItemInput } from '../../data/repositories';

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
