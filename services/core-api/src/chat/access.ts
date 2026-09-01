import type { OrderStatus } from '../orders/stateMachine';

export type ChatChannel = 'customer_rider' | 'customer_merchant';

/** ทุกคนที่เกี่ยวข้องกับออเดอร์ใบนั้น service เป็นคนหามาให้ */
export type OrderParties = {
  customerId: string;
  riderId: string | null;
  restaurantOwnerId: string;
  status: OrderStatus;
};

/** ใครอ่านช่องไหนได้ (design C10 M10) */
export function canReadChannel(input: {
  viewerId: string;
  channel: ChatChannel;
  parties: OrderParties;
}): boolean {
  const { viewerId, parties } = input;
  if (input.channel === 'customer_rider') {
    return viewerId === parties.customerId || (!!parties.riderId && viewerId === parties.riderId);
  }
  return viewerId === parties.customerId || viewerId === parties.restaurantOwnerId;
}

/** ช่องคุยกับไรเดอร์จะมีอยู่ก็ต่อเมื่อมีไรเดอร์แล้ว */
export function channelExists(channel: ChatChannel, parties: OrderParties): boolean {
  return channel === 'customer_merchant' || !!parties.riderId;
}

/** ส่งข้อความได้เมื่อออเดอร์ยังเดินอยู่เท่านั้น (แบบเดียวกับ Grab / LINE MAN) */
export function canSend(status: OrderStatus): boolean {
  return status !== 'delivered' && status !== 'cancelled';
}
