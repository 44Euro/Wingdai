import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import { useAuthStore } from '../auth/authStore';
import { isActiveStatus } from '../../data/orderStateMachine';
import type { OrderStatus } from '../../data/types';
import { planReorder, type ReorderPlan } from './reorder';
import { buildNotifications, type AppNotification } from './notifications';
import { useNotificationStore } from './notificationStore';
import { useCartStore } from '../cart/cartStore';
import { usePaymentStore } from '../payment/paymentStore';
import { orderTotals } from '../cart/pricing';
import { fetchRoute, interpolatePosition, progressBetweenPings, PING_INTERVAL_MS } from '../../lib/route';
import type { Address, Order, Restaurant } from '../../data/types';
import type { CreateOrderInput, NewAddressInput } from '../../data/repositories';

/** กรองเฉพาะร้านที่อนุมัติแล้ว ลูกค้าไม่ควรเห็นร้านที่ยังรออนุมัติ (แยกเป็น pure fn เพื่อทดสอบ) */
export function filterApproved(list: Restaurant[]): Restaurant[] {
  return list.filter((r) => r.isApproved);
}

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => filterApproved(await repos.catalog.listRestaurants()),
  });
}

/** ค้นร้าน/เมนู ยิงเฉพาะตอนมีคำค้นจริง ไม่งั้น query ว่างจะกวาดทั้งฐาน */
export function useSearchRestaurants(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['searchRestaurants', q],
    queryFn: async () => filterApproved(await repos.catalog.searchRestaurants(q)),
    enabled: q.length > 0,
  });
}

export function useRestaurant(id: string) {
  return useQuery({ queryKey: ['restaurant', id], queryFn: () => repos.catalog.getRestaurant(id) });
}

export function useMenu(restaurantId: string) {
  return useQuery({ queryKey: ['menu', restaurantId], queryFn: () => repos.catalog.getMenu(restaurantId) });
}

/** สั่งซ้ำจากใบเก่า (design C33) */
/** รายการโปรด (design C19) */
export function useFavoriteIds() {
  const accountId = useAuthStore((s) => s.account?.id);
  return useQuery({
    queryKey: ['favorites', 'ids', accountId],
    queryFn: () => repos.favorites.ids(),
    enabled: !!accountId,
  });
}

export function useFavorites() {
  const accountId = useAuthStore((s) => s.account?.id);
  return useQuery({
    queryKey: ['favorites', 'list', accountId],
    queryFn: () => repos.favorites.list(),
    enabled: !!accountId,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, on }: { restaurantId: string; on: boolean }) =>
      repos.favorites.set(restaurantId, on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}

export function useReorder() {
  const cart = useCartStore();
  return useMutation({
    mutationFn: async (order: Order): Promise<ReorderPlan> => {
      const menu = await repos.catalog.getMenu(order.restaurantId);
      return planReorder(order, menu);
    },
    onSuccess: (plan, order) => {
      if (plan.lines.length === 0) return;
      // ตะกร้าถือได้ร้านเดียว การสั่งซ้ำจึงแทนที่ของเดิมเสมอ ไม่ใช่เอาไปต่อท้าย
      cart.clear();
      for (const line of plan.lines) {
        cart.addLine(order.restaurantId, {
          menuItem: line.menuItem,
          selectedChoices: line.selectedChoices,
          quantity: line.quantity,
          ...(line.note ? { note: line.note } : {}),
        });
      }
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => repos.orders.create(input),
    /** ต้องล้าง ['orders'] ทันที ไม่งั้นปุ่มเช็คออร์เดอร์กลาง navbar ไม่โผล่ */
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });
}

/** "สั่งเลย" ประกอบ input จากตะกร้า + บัญชีที่ล็อกอินอยู่ แล้วล้างตะกร้าเมื่อสำเร็จ */
export function usePlaceOrder() {
  const cart = useCartStore();
  const account = useAuthStore((s) => s.account);
  const createOrder = useCreateOrder();
  const paymentMethod = usePaymentStore((s) => s.method);
  // ค่าส่งขึ้นกับระยะตั้งแต่ SA6 อ่านระยะจากร้านในตะกร้า ไม่ใช่ค่าคงที่
  const { data: restaurant } = useRestaurant(cart.restaurantId ?? '');
  const totals = orderTotals(cart.foodTotal(), restaurant?.distanceKm ?? null);

  function placeOrder(handlers: { onSuccess: (order: Order) => void; onError: () => void }) {
    if (!cart.restaurantId || !account) return;
    createOrder.mutate(
      {
        restaurantId: cart.restaurantId,
        /** ส่งแค่ "อยากได้อะไร" ไม่ส่งราคาและไม่ส่ง customerId */
        items: cart.lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          choiceIds: l.selectedChoices.map((c) => c.choiceId),
          ...(l.note ? { note: l.note } : {}),
        })),
        paymentMethod,
        // §7 คำขอของลูกค้า ไม่ใช่ของไรเดอร์ ส่งไปตั้งแต่ตอนสร้างออร์เดอร์
        leaveAtDoor: cart.leaveAtDoor,
      },
      {
        onSuccess: (order) => {
          cart.clear();
          handlers.onSuccess(order);
        },
        onError: handlers.onError,
      },
    );
  }

  return { placeOrder, totals, isPending: createOrder.isPending, canPlace: cart.lines.length > 0 };
}

export function useCustomerOrders() {
  const accountId = useAuthStore((s) => s.account?.id);
  return useQuery({
    queryKey: ['orders', accountId],
    queryFn: () => (accountId ? repos.orders.listForCustomer(accountId) : Promise.resolve([])),
    enabled: !!accountId,
  });
}

/** ออร์เดอร์ที่ยังไม่จบใบล่าสุด ใช้ตัดสินว่าจะโชว์ปุ่มแฮมเบอร์เกอร์กลาง navbar ไหม */
export function pickActiveOrder(orders: Order[]): Order | undefined {
  const active = orders.filter((o) => isActiveStatus(o.status));
  if (active.length === 0) return undefined;
  return active.reduce((newest, o) => (o.createdAt > newest.createdAt ? o : newest));
}

export function useActiveOrder(): Order | undefined {
  const { data } = useCustomerOrders();
  return pickActiveOrder(data ?? []);
}

/** ออร์เดอร์ใบเดียว */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => repos.orders.get(orderId),
    enabled: orderId.length > 0,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && s !== 'delivered' && s !== 'cancelled' ? PING_INTERVAL_MS : false;
    },
  });
}

/** เส้นทางส่งตามถนน ดึง ครั้งเดียวต่อออร์เดอร์ */
export function useDeliveryRoute(order: Order | null | undefined) {
  const from = order?.restaurantLat !== null && order?.restaurantLng !== null && order
    ? { lat: order.restaurantLat, lng: order.restaurantLng }
    : null;
  const to = order?.dropoffLat !== null && order?.dropoffLng !== null && order
    ? { lat: order.dropoffLat, lng: order.dropoffLng }
    : null;

  return useQuery({
    queryKey: ['route', order?.id],
    queryFn: () => fetchRoute(from!, to!),
    enabled: !!order && from !== null && to !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

/** ตำแหน่งไรเดอร์ที่ไหลลื่นระหว่างสองครั้งที่ส่งพิกัดมา (§5 client-side interpolation) */
export function useSmoothedRiderPosition(target: { lat: number; lng: number } | null) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const to = useRef(target);
  const since = useRef(Date.now());

  useEffect(() => {
    if (!target) {
      from.current = null;
      to.current = null;
      setShown(null);
      return undefined;
    }
    // พิกัดใหม่มาถึง เริ่มไหลจากจุดที่วาดอยู่ตอนนี้ ไม่ใช่จากพิกัดเก่าที่เลยไปแล้ว
    from.current = shown ?? target;
    to.current = target;
    since.current = Date.now();

    const id = setInterval(() => {
      const a = from.current;
      const b = to.current;
      if (!a || !b) return;
      setShown(interpolatePosition(a, b, progressBetweenPings(Date.now() - since.current)));
    }, 1000 / 30);
    return () => clearInterval(id);
    // ผูกกับพิกัดปลายทางเท่านั้น ใส่ `shown` ลงไปจะรีสตาร์ตนาฬิกาทุกเฟรม
  }, [target?.lat, target?.lng]);

  return shown;
}

/** จ่ายออร์เดอร์เงินสดที่ค้างอยู่ด้วยพร้อมเพย์แทน (ลูกค้าเงินสดไม่พอ) */
export function usePayWithPromptPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => repos.orders.payWithPromptPay(orderId),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', order.id], order);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/** ทิปให้ไรเดอร์ (design C11) เข้าไรเดอร์ 100% ไม่หักคอม */
export function useTipRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amountSatang }: { orderId: string; amountSatang: number }) =>
      repos.orders.tip(orderId, amountSatang),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', order.id], order);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['rider'] });
    },
  });
}

/** ที่อยู่จัดส่งของลูกค้า ต้องมีอย่างน้อยหนึ่งที่ถึงจะสั่งอาหารได้ */
export function useAddresses() {
  const accountId = useAuthStore((s) => s.account?.id);
  return useQuery({
    queryKey: ['addresses', accountId],
    queryFn: () => repos.addresses.list(),
    enabled: !!accountId,
  });
}

/** ที่อยู่ตั้งต้น = ที่บันทึกไว้ก่อนสุด ตรงกับที่เซิร์ฟเวอร์เลือกเมื่อออร์เดอร์ไม่ระบุมา */
export function useDefaultAddress(): Address | undefined {
  const { data } = useAddresses();
  return data?.[0];
}

export function useAddAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewAddressInput) => repos.addresses.add(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

/** รายการแจ้งเตือน (C20) ประกอบจากออร์เดอร์จริง + ชื่อร้าน ดู notifications.ts ว่าทำไมไม่เก็บเป็นตารางแยก */
export function useNotifications(): AppNotification[] {
  const { data: orders = [] } = useCustomerOrders();
  const { data: restaurants = [] } = useRestaurants();
  const lastReadAt = useNotificationStore((s) => s.lastReadAt);
  return buildNotifications(orders, restaurants, lastReadAt);
}

/** ลูกค้ายกเลิกออร์เดอร์ (design C27) */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      repos.orders.updateStatus(orderId, status),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
