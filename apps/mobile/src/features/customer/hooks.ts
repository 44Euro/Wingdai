import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import { useAuthStore } from '../auth/authStore';
import { isActiveStatus } from '../../data/orderStateMachine';
import { buildNotifications, type AppNotification } from './notifications';
import { useNotificationStore } from './notificationStore';
import { useCartStore } from '../cart/cartStore';
import { usePaymentStore } from '../payment/paymentStore';
import { orderTotals } from '../cart/pricing';
import type { Address, Order, Restaurant } from '../../data/types';
import type { CreateOrderInput, NewAddressInput } from '../../data/repositories';

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

/**
 * ค้นร้าน/เมนู — ยิงเฉพาะตอนมีคำค้นจริง ไม่งั้น query ว่างจะกวาดทั้งฐาน
 * กรองร้านที่ยังไม่อนุมัติออกซ้ำอีกชั้นเหมือน useRestaurants
 */
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

export function useCreateOrder() {
  return useMutation({ mutationFn: (input: CreateOrderInput) => repos.orders.create(input) });
}

/**
 * "สั่งเลย" — ประกอบ input จากตะกร้า + บัญชีที่ล็อกอินอยู่ แล้วล้างตะกร้าเมื่อสำเร็จ
 * รวมไว้ที่เดียวเพราะมีสองทางเข้า: จ่ายเงินสด (จบที่จอ Checkout) กับพร้อมเพย์ (จบที่จอ QR)
 */
export function usePlaceOrder() {
  const cart = useCartStore();
  const account = useAuthStore((s) => s.account);
  const createOrder = useCreateOrder();
  const paymentMethod = usePaymentStore((s) => s.method);
  const totals = orderTotals(cart.foodTotal());

  function placeOrder(handlers: { onSuccess: (order: Order) => void; onError: () => void }) {
    if (!cart.restaurantId || !account) return;
    createOrder.mutate(
      {
        restaurantId: cart.restaurantId,
        /**
         * ส่งแค่ "อยากได้อะไร" ไม่ส่งราคาและไม่ส่ง customerId
         * ราคาที่โชว์ในตะกร้าเป็นการคาดการณ์เพื่อความสะดวก — ยอดที่นับจริงมาจากเซิร์ฟเวอร์
         * ถ้าสองค่าไม่ตรงกัน ให้เชื่อเซิร์ฟเวอร์ เพราะมันอ่านราคาจากเมนูในฐานตรง ๆ
         */
        items: cart.lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          choiceIds: l.selectedChoices.map((c) => c.choiceId),
        })),
        paymentMethod,
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

/**
 * ออร์เดอร์ที่ยังไม่จบใบล่าสุด — ใช้ตัดสินว่าจะโชว์ปุ่มแฮมเบอร์เกอร์กลาง navbar ไหม
 * แยกเป็น pure fn เพื่อทดสอบได้โดยไม่ต้อง mount react-query (แบบเดียวกับ filterApproved)
 */
export function pickActiveOrder(orders: Order[]): Order | undefined {
  const active = orders.filter((o) => isActiveStatus(o.status));
  if (active.length === 0) return undefined;
  return active.reduce((newest, o) => (o.createdAt > newest.createdAt ? o : newest));
}

export function useActiveOrder(): Order | undefined {
  const { data } = useCustomerOrders();
  return pickActiveOrder(data ?? []);
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => repos.orders.get(orderId),
    enabled: orderId.length > 0,
  });
}

/**
 * จ่ายออร์เดอร์เงินสดที่ค้างอยู่ด้วยพร้อมเพย์แทน (ลูกค้าเงินสดไม่พอ)
 * ล้าง cache ทั้งใบเดียวและรายการ เพื่อให้จอติดตามกับจอประวัติเปลี่ยนพร้อมกัน
 */
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

/**
 * ที่อยู่จัดส่งของลูกค้า — ต้องมีอย่างน้อยหนึ่งที่ถึงจะสั่งอาหารได้
 * (เซิร์ฟเวอร์ปฏิเสธออร์เดอร์ที่ไม่มีที่อยู่ เพราะไรเดอร์ต้องรู้ว่าจะไปส่งที่ไหน)
 */
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

/** รายการแจ้งเตือน (C20) — ประกอบจากออร์เดอร์จริง + ชื่อร้าน ดู notifications.ts ว่าทำไมไม่เก็บเป็นตารางแยก */
export function useNotifications(): AppNotification[] {
  const { data: orders = [] } = useCustomerOrders();
  const { data: restaurants = [] } = useRestaurants();
  const lastReadAt = useNotificationStore((s) => s.lastReadAt);
  return buildNotifications(orders, restaurants, lastReadAt);
}
