import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { orderMessages, orders, restaurants, accounts } from '../db/schema';
import { canReadChannel, canSend, channelExists, type ChatChannel, type OrderParties } from './access';

export type ChatMessage = {
  id: string;
  senderAccountId: string;
  senderName: string;
  /** ข้อความของตัวเองอยู่ชิดขวา ของอีกฝ่ายชิดซ้าย จอไม่ต้องรู้ว่า "ตัวเอง" คือ id ไหน */
  mine: boolean;
  body: string;
  createdAt: string;
};

export type ChatThread = {
  orderId: string;
  channel: ChatChannel;
  /** ชื่อคนที่กำลังคุยด้วย null = ยังไม่มีไรเดอร์ (ช่องนั้นจะยังเปิดไม่ได้อยู่แล้ว) */
  peerName: string | null;
  /** ปิดรับข้อความใหม่แล้วหรือยัง งานจบแล้วเป็นอ่านอย่างเดียว */
  closed: boolean;
  messages: ChatMessage[];
};

/** แชทของออเดอร์ (design C10 M10) แบบเดียวกับ Grab / LINE MAN */
@Injectable()
export class ChatService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** ตอบ 404 ทุกกรณีที่เข้าไม่ได้ ไม่ว่าจะเพราะออเดอร์ไม่มีจริง หรือเพราะไม่ใช่คู่สนทนา */
  private async partiesOf(orderId: string): Promise<OrderParties> {
    const [row] = await this.db
      .select({
        customerId: orders.customerId,
        riderId: orders.riderId,
        status: orders.status,
        restaurantOwnerId: restaurants.ownerUserId,
      })
      .from(orders)
      .innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!row) throw new NotFoundException({ message: 'ไม่พบออเดอร์นี้' });
    return row;
  }

  private assertAccess(viewerId: string, channel: ChatChannel, parties: OrderParties) {
    if (!channelExists(channel, parties) || !canReadChannel({ viewerId, channel, parties })) {
      throw new NotFoundException({ message: 'ไม่พบห้องแชทนี้' });
    }
  }

  async thread(viewerId: string, orderId: string, channel: ChatChannel): Promise<ChatThread> {
    const parties = await this.partiesOf(orderId);
    this.assertAccess(viewerId, channel, parties);

    const rows = await this.db
      .select({ message: orderMessages, senderName: accounts.fullName })
      .from(orderMessages)
      .innerJoin(accounts, eq(accounts.id, orderMessages.senderAccountId))
      .where(and(eq(orderMessages.orderId, orderId), eq(orderMessages.channel, channel)))
      .orderBy(asc(orderMessages.createdAt));

    return {
      orderId,
      channel,
      peerName: await this.peerName(viewerId, channel, parties),
      closed: !canSend(parties.status),
      messages: rows.map((r) => ({
        id: r.message.id,
        senderAccountId: r.message.senderAccountId,
        senderName: r.senderName,
        mine: r.message.senderAccountId === viewerId,
        body: r.message.body,
        createdAt: r.message.createdAt.toISOString(),
      })),
    };
  }

  async send(viewerId: string, orderId: string, channel: ChatChannel, body: string) {
    const parties = await this.partiesOf(orderId);
    this.assertAccess(viewerId, channel, parties);

    if (!canSend(parties.status)) {
      throw new BadRequestException({ message: 'ออเดอร์นี้จบแล้ว ส่งข้อความไม่ได้' });
    }

    const text = body.trim();
    if (!text) throw new BadRequestException({ message: 'พิมพ์ข้อความก่อนส่ง' });

    const [row] = await this.db
      .insert(orderMessages)
      .values({ orderId, channel, senderAccountId: viewerId, body: text })
      .returning({ id: orderMessages.id });

    return { id: row!.id };
  }

  /** ชื่อของอีกฝ่าย จอต้องบอกได้ว่ากำลังคุยกับใคร ไม่ใช่ "ห้องแชท" เฉย ๆ */
  private async peerName(
    viewerId: string,
    channel: ChatChannel,
    parties: OrderParties,
  ): Promise<string | null> {
    const peerId = channel === 'customer_rider'
      ? (viewerId === parties.customerId ? parties.riderId : parties.customerId)
      : (viewerId === parties.customerId ? parties.restaurantOwnerId : parties.customerId);

    if (!peerId) return null;
    const [row] = await this.db
      .select({ fullName: accounts.fullName })
      .from(accounts)
      .where(eq(accounts.id, peerId))
      .limit(1);
    return row?.fullName ?? null;
  }
}
