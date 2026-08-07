import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type { WriteReviewInput } from '../../data/repositories';

export function useOrderReview(orderId: string) {
  return useQuery({
    queryKey: ['reviews', 'order', orderId],
    queryFn: () => repos.reviews.forOrder(orderId),
    enabled: !!orderId,
  });
}

export function useRestaurantReviews(restaurantId: string) {
  return useQuery({
    queryKey: ['reviews', 'restaurant', restaurantId],
    queryFn: () => repos.reviews.forRestaurant(restaurantId),
    enabled: !!restaurantId,
  });
}

export function useMyRestaurantReviews(restaurantId: string) {
  return useQuery({
    queryKey: ['reviews', 'merchant', restaurantId],
    queryFn: () => repos.reviews.forMyRestaurant(restaurantId),
    enabled: !!restaurantId,
  });
}

/** เขียนรีวิว */
export function useWriteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...input }: WriteReviewInput & { orderId: string }) =>
      repos.reviews.write(orderId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      for (const key of ['restaurants', 'restaurant', 'searchRestaurants']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
