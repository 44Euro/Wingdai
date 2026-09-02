import type {
  Repos, RegisterInput, GoogleRegisterInput, CreateOrderInput, NewAddressInput,
} from '../repositories';
import type {
  Account, AccountType, Address, MenuItem, Order, OrderStatus, Restaurant, RefundCase, RefundFault,
  RiderApplication, Zone, RiderPayout, RiderWorkBase, EarningsPeriod, RiderIssueKind,
  RiderDocument, RiderDocumentKind, PaymentMethod, FeatureFlagKey, PlatformPricing, AuditRow,
  TicketKind, TicketStatus, SupportTicket, Review, ReviewSummary, ChatChannel,
  WeeklyHours, MerchantRestaurant,
  MerchantPayout,
} from '../types';
import { assertTransition, isActiveStatus } from '../orderStateMachine';
import { matchesFilter } from '../../lib/adminOrders';
import { commissionOf } from '../../lib/commission';
import { deliveryFeeOf } from '../../features/cart/pricing';
import { canOrderFromRestaurant, canPayNowWithPromptPay } from '../../lib/rules';
import { validateDraft } from '../../lib/riderApplication';
import { isOutsideOfficeHours, nextOpenAt } from '../../lib/officeHours';
import {
  effectiveIsOpen, MAX_PAUSE_MINUTES, nextOpenAt as nextShopOpenAt,
} from '../../lib/openingHours';
import { haversineKm } from '../../lib/geo';
import { periodStart } from '../../lib/period';
import {
  seedAccounts, seedRestaurants, seedMenuItems, seedAddresses, seedRestaurantCoords, MOCK_PASSWORD,
} from './seed';

/** สถานะที่ครัวยังต้องทำต่อ ต้องตรงกับ QUEUE_STATUSES ใน core-api/src/merchant/merchant.service.ts */
const QUEUE_STATUSES: OrderStatus[] = ['created', 'accepted', 'preparing'];

/** รหัส OTP ที่ mock ยอมรับ ของจริงสุ่มหกหลักแล้วส่ง SMS */
export const MOCK_OTP = '123456';
export const MOCK_VERIFICATION_TOKEN = 'mock-verification-token';
const MOCK_GOOGLE_TOKEN = 'mock-google-token';

/** เพดานเงินสดในมือ ตรงกับ rider_profiles.cash_limit_satang ฝั่งเซิร์ฟเวอร์ (฿1,500) */
const CASH_LIMIT_SATANG = 150000;
/** เพดานทิปต่อออเดอร์ ต้องตรงกับ `MAX_TIP_SATANG` ใน orders/tipping.ts ฝั่งเซิร์ฟเวอร์ */
const MAX_TIP_SATANG = 50000;

/** ข้อความบอกแอดมินว่าไรเดอร์เจออะไร (R9) */
const RIDER_ISSUE_DETAIL: Record<RiderIssueKind, string> = {
  cannot_reach_customer: 'ไรเดอร์ติดต่อลูกค้าไม่ได้ — โทรหาลูกค้าแทน หรือบอกไรเดอร์ว่าให้ทำยังไงต่อ',
  bad_address: 'ที่อยู่ผิดหรือหาไม่เจอ — โทรถามลูกค้าแล้วแจ้งพิกัดที่ถูกให้ไรเดอร์',
  accident: 'ไรเดอร์แจ้งอุบัติเหตุ — โทรหาไรเดอร์ก่อนเรื่องอื่นทั้งหมด',
};

/** สถานะที่แจ้งปัญหาได้ ต้องเป็นงานที่ยังอยู่ในมือไรเดอร์จริง ๆ */
const ISSUE_REPORTABLE: OrderStatus[] = ['accepted', 'preparing', 'picked_up'];

/** เอกสารหกชนิดที่ §7 บังคับ ต้องตรงกับ RIDER_DOCUMENT_KINDS ฝั่งเซิร์ฟเวอร์ */
const DOCUMENT_KINDS: RiderDocumentKind[] = [
  'selfie', 'id_card_front', 'id_card_back', 'licence', 'vehicle_book', 'insurance',
];

/** นามสกุลที่รับ ตรงกับ ALLOWED_EXT ใน core-api/src/storage/storage.service.ts */
const ALLOWED_DOC_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

/** โซนที่เปิดให้บริการใน mock ของจริงมาจากตาราง zones ที่มีขอบเขต PostGIS */
const MOCK_ZONES: (Zone & { lat: number; lng: number })[] = [
  { id: 'z-ari', name: 'อารีย์', type: 'mixed', lat: 13.7797, lng: 100.5442 },
];

/** feature flag สี่ตัว ต้องตรงกับ `FEATURE_FLAG_KEYS` ใน core-api/src/platform/platform.service.ts */
const MOCK_FLAG_KEYS: FeatureFlagKey[] = [
  'cash_payment', 'card_payment', 'auto_dispatch', 'registration_open',
];

/** ค่าตั้งต้นของราคา ต้องตรงกับ DEFAULT_PRICING ใน core-api/src/orders/pricing.ts */
const DEFAULT_MOCK_PRICING: Omit<PlatformPricing, 'updatedAt'> = {
  commissionRateBp: 1500,
  deliveryBaseSatang: 1500,
  deliveryPerKmSatang: 600,
  serviceFeeSatang: 500,
};

/** ชื่อบัญชีตรงกับชื่อตามกฎหมายไหม ธงกันบัญชีม้า (§7) */
function bankNameMatchesLegalName(bankAccountName: string, fullName: string): boolean {
  const strip = (v: string) =>
    v.replace(/(นาย|นาง|นางสาว|น\.ส\.|mr\.?|mrs\.?|ms\.?)/gi, '').replace(/\s+/g, '').toLowerCase();
  return strip(bankAccountName) === strip(fullName);
}

export function createMockRepos(): Repos {
  // state แยกต่อ instance เพื่อให้เทสต์ไม่รบกวนกัน
  const accounts: Account[] = seedAccounts.map((a) => ({ ...a }));
  const restaurants: Restaurant[] = seedRestaurants.map((r) => ({ ...r }));
  const menuItems: MenuItem[] = seedMenuItems.map((m) => ({ ...m }));
  const addresses: (Address & { accountId: string })[] = seedAddresses.map((a) => ({ ...a }));
  const orders: Order[] = [];
  /** ใบขอถอนของร้าน อยู่ในหน่วยความจำเหมือนของอื่นในโหมดจำลอง */
  const merchantPayouts: MerchantPayout[] = [];

  /** ยอดถอนของร้าน คิดที่เดียวแล้วใช้ร่วมกันทั้งตอนอ่านและตอนขอถอน */
  function payoutBalanceOf(restaurantId: string) {
    const earned = orders
      .filter((o) => o.restaurantId === restaurantId && o.status === 'delivered')
      .reduce((sum, o) => sum + (o.foodTotal - Math.round(o.foodTotal * 0.15)), 0);
    const paid = merchantPayouts
      .filter((p) => p.restaurantId === restaurantId && p.status === 'paid')
      .reduce((sum, p) => sum + p.amountSatang, 0);
    const pending = merchantPayouts.find(
      (p) => p.restaurantId === restaurantId && p.status === 'requested',
    ) ?? null;
    const payableSatang = earned - paid;
    const pendingSatang = pending?.amountSatang ?? 0;
    return {
      payableSatang,
      pendingSatang,
      withdrawableSatang: payableSatang - pendingSatang,
      pending,
    };
  }
  const refundCases: RefundCase[] = [];
  /** รีวิว (design C11) ของจริงคือตาราง `reviews` ผูกกับออเดอร์ หนึ่งใบหนึ่งรีวิว */
  const reviewList: (Review & { restaurantId: string })[] = [];

  /** ข้อความแชทของออเดอร์ (design C10 M10) ของจริงคือตาราง `order_messages` */
  const chatMessages: {
    id: string; orderId: string; channel: ChatChannel;
    senderAccountId: string; body: string; createdAt: string;
  }[] = [];

  const chatPartiesOf = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new Error('ไม่พบห้องแชทนี้');
    const shop = restaurants.find((r) => r.id === order.restaurantId);
    return { order, ownerId: shop?.ownerUserId ?? '' };
  };

  /** ใครอ่านช่องไหนได้ กติกาชุดเดียวกับ `chat/access.ts` ฝั่งเซิร์ฟเวอร์ */
  const chatCanRead = (
    viewerId: string,
    channel: ChatChannel,
    order: Order,
    ownerId: string,
  ): boolean => (channel === 'customer_rider'
    ? viewerId === order.customerId || (!!order.riderId && viewerId === order.riderId)
    : viewerId === order.customerId || viewerId === ownerId);

  /** คะแนนเฉลี่ยของร้านจากรีวิวจริง คิดตอนอ่านเหมือนฝั่งเซิร์ฟเวอร์ ไม่เก็บซ้ำไว้บนแถวร้าน */
  /** ระยะส่งสูงสุดต่อออเดอร์ ต้องตรงกับ `MAX_DELIVERY_RADIUS_KM` ฝั่งเซิร์ฟเวอร์ */
  const MAX_DELIVERY_RADIUS_KM = 5;
  const withinRadius = (r: Restaurant) => r.distanceKm === null || r.distanceKm <= MAX_DELIVERY_RADIUS_KM;

  const withRating = (r: Restaurant): Restaurant => {
    const stars = reviewList.filter((v) => v.restaurantId === r.id).map((v) => v.restaurantRating);
    if (stars.length === 0) return { ...r, rating: null };
    const mean = stars.reduce((sum, n) => sum + n, 0) / stars.length;
    return { ...r, rating: Math.round(mean * 10) / 10 };
  };

  /** ตารางเวลาและการพักของแต่ละร้าน (design M11) ของจริงคือคอลัมน์ `opening_hours` */
  /** ร้านที่แต่ละบัญชีบันทึกไว้ (design C19) ของจริงคือตาราง `favorites` */
  const favoriteIds = new Map<string, Set<string>>();

  const shopHours = new Map<string, WeeklyHours>();
  const shopPausedUntil = new Map<string, string>();

  /** ผลลัพธ์ที่ลูกค้าเห็น เซิร์ฟเวอร์คิดให้แบบเดียวกันใน `catalog.service.ts` → `toPublic` */
  const withOpenState = (r: Restaurant): Restaurant => {
    const hours = shopHours.get(r.id) ?? {};
    const paused = shopPausedUntil.get(r.id);
    const at = new Date();
    const opensAt = nextShopOpenAt(hours, at);
    return {
      ...r,
      isOpen: effectiveIsOpen({
        isOpen: r.isOpen,
        isApproved: r.isApproved,
        hours,
        pausedUntil: paused ? new Date(paused) : null,
        at,
      }),
      opensAt: opensAt ? opensAt.toISOString() : null,
    };
  };

  /** แถวร้านอย่างที่เจ้าของเห็น ต่างจากฝั่งลูกค้าตรงที่เห็นตารางดิบเพื่อเอาไปแก้ */
  const toMerchantRestaurant = (r: Restaurant): MerchantRestaurant => {
    const paused = shopPausedUntil.get(r.id);
    const pausedUntil = paused && new Date(paused).getTime() > Date.now() ? paused : null;
    return {
      id: r.id,
      name: r.name,
      isApproved: r.isApproved,
      isOpen: r.isOpen,
      prepTimeMinutes: r.prepTimeMinutes,
      openingHours: shopHours.get(r.id) ?? {},
      pausedUntil,
      isAcceptingOrders: withOpenState(r).isOpen,
    };
  };

  /** สรุปคะแนนของร้านหนึ่ง คืนครบทั้งห้าระดับเสมอ รวมระดับที่ไม่มีใครให้ */
  const summariseMock = (restaurantId: string): ReviewSummary => {
    const mine = reviewList
      .filter((v) => v.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const stars = mine.map((v) => v.restaurantRating);
    const breakdown = ([5, 4, 3, 2, 1] as const).map((n) => ({
      stars: n,
      count: stars.filter((s) => s === n).length,
    }));
    const average = stars.length === 0
      ? null
      : Math.round((stars.reduce((sum, n) => sum + n, 0) / stars.length) * 10) / 10;
    return { average, count: stars.length, breakdown, reviews: mine.map((v) => ({ ...v })) };
  };
  /** เรื่องที่ไรเดอร์แจ้ง (R9) ของจริงคือตาราง rider_issues */
  const riderIssueList: {
    id: string; orderId: string; riderId: string; kind: RiderIssueKind;
    detail: string | null; createdAt: string; resolvedAt: string | null;
  }[] = [];
  /** เวลาที่ส่งถึงของแต่ละใบ ชนิด `Order` ฝั่งแอปไม่มีช่องนี้ (เซิร์ฟเวอร์มี `delivered_at`) */
  const deliveredAtById = new Map<string, string>();
  /** เวลาที่รับของจากร้าน ใช้คู่กับ `deliveredAtById` เพื่อบอกว่าเที่ยวนั้นใช้เวลาเท่าไหร่ */
  const pickedUpAtById = new Map<string, string>();
  /** เวลาที่ร้านกดรับออเดอร์ ตั้งต้นของการนับถอยหลังอาหารเสร็จบนจอ R10 (§6.3) */
  const acceptedAtById = new Map<string, string>();
  /** ยอดที่จ่ายให้ร้านไปแล้วสะสม (design AD7) ของจริงคือแถว `restaurant.payout` ใน ledger */
  const restaurantSettled = new Map<string, number>();
  /** ใบสมัครไรเดอร์ในหน่วยความจำ ของจริงคือตาราง rider_profiles */
  const riderApplications = new Map<string, RiderApplication>();
  /** เอกสารไรเดอร์ ของจริงคือตาราง rider_documents (คีย์: `${accountId}:${kind}`) */
  const riderDocs = new Map<string, RiderDocument>();
  /** uri ของรูปที่อัปไว้ (คีย์เดียวกับ `riderDocs`) */
  const riderDocUris = new Map<string, string>();

  /** ── สถานะที่ซูเปอร์แอดมินแก้ได้ (design SA2–SA6) ─────────────────────── */

  /** ของจริงคือตาราง `platform_pricing` แถวเดียว */
  let pricing: PlatformPricing = { ...DEFAULT_MOCK_PRICING, updatedAt: null };
  /** ของจริงคือตาราง `feature_flags` ตัวที่ยังไม่เคยตั้งใช้ค่าตั้งต้น ไม่ใช่หายไปจากรายการ */
  const flags: Record<FeatureFlagKey, boolean> = {
    cash_payment: true, card_payment: true, auto_dispatch: true, registration_open: true,
  };
  const zoneList = MOCK_ZONES.map((z) => ({ ...z }));
  /** ประวัติการกระทำ เพิ่มได้อย่างเดียว ไม่มีที่ไหนในไฟล์นี้ที่แก้หรือลบแถวเดิม */
  const auditRows: AuditRow[] = [];

  /** ตั๋วซัพพอร์ต (design AD4) ของจริงคือตาราง support_tickets */
  const tickets: {
    id: string; orderId: string | null; openedByAccountId: string; kind: TicketKind;
    subject: string; status: TicketStatus; createdAt: string;
  }[] = [];
  /** ข้อความในเธรด ข้อความแรกของตั๋วก็อยู่ในนี้ ไม่ใช่คอลัมน์บนตั๋ว */
  const ticketMessages: {
    id: string; ticketId: string; authorAccountId: string; body: string; createdAt: string;
  }[] = [];

  const toTicketRow = (t: (typeof tickets)[number]): SupportTicket => ({
    id: t.id,
    orderId: t.orderId,
    orderReference: orders.find((o) => o.id === t.orderId)?.reference ?? null,
    kind: t.kind,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt,
    openedByName: accounts.find((a) => a.id === t.openedByAccountId)?.fullName ?? '',
    messageCount: ticketMessages.filter((m) => m.ticketId === t.id).length,
  });

  /** เจ้าของตั๋วกับผู้ดูแลระบบเท่านั้น กฎเดียวกับ `canReadTicket` ฝั่งเซิร์ฟเวอร์ */
  const readableTicket = (me: Account, ticketId: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('ไม่พบตั๋วนี้');
    const isStaff = me.accountType === 'admin' || me.accountType === 'super_admin';
    if (ticket.openedByAccountId !== me.id && !isStaff) throw new Error('ตั๋วนี้ไม่ใช่ของคุณ');
    return ticket;
  };

  const writeAudit = (
    actor: Account,
    entry: Pick<AuditRow, 'action' | 'subjectType' | 'subjectId' | 'before' | 'after'>,
  ) => {
    auditRows.unshift({
      id: `au-${++seq}`,
      actorName: actor.fullName,
      actorUsername: actor.username,
      createdAt: new Date().toISOString(),
      ...entry,
    });
  };

  /** เอกสารครบทุกชนิดของบัญชีนี้ ชนิดที่ยังไม่ส่งได้ `missing` ไม่ใช่หายไปจากรายการ */
  const documentsOf = (accountId: string): RiderDocument[] =>
    DOCUMENT_KINDS.map((kind) => riderDocs.get(`${accountId}:${kind}`) ?? {
      kind, status: 'missing' as const, rejectionReason: null, uploadedAt: null,
    });
  let seq = 0;

  /** บัญชีที่ล็อกอินอยู่ ของจริงเซิร์ฟเวอร์รู้จาก token */
  let current: Account | null = null;

  const delay = () => new Promise<void>((r) => setTimeout(r, 0));

  const requireLogin = (): Account => {
    if (!current) throw new Error('ต้องเข้าสู่ระบบก่อน');
    return current;
  };

  /** คู่แฝดของ `SuperAdminGuard` แอดมินธรรมดาต้องโดนปฏิเสธที่ชั้นข้อมูล ไม่ใช่แค่ไม่เห็นแท็บ */
  const requireSuper = (): Account => {
    const me = requireLogin();
    if (me.accountType !== 'super_admin') throw new Error('ต้องเป็นซูเปอร์แอดมิน');
    return me;
  };

  /** สถานะไรเดอร์ในหน่วยความจำ ของจริงอยู่ที่ตาราง rider_status */
  const riderStates = new Map<
    string,
    {
      isOnline: boolean; onlineSince: string | null; cashHeld: number;
      declined: Set<string>; paidOutSatang: number; tipsSatang: number; pendingPayout: RiderPayout | null;
      workBase: RiderWorkBase | null; lastLocation: { lat: number; lng: number } | null;
      /** เวลาที่ส่งพิกัดมาล่าสุด แผนที่ ops (AD8) ใช้บอกว่าหมุดนี้เก่าแค่ไหน */
      lastPingAt: string | null;
    }
  >();
  const riderState = (accountId: string) => {
    let s = riderStates.get(accountId);
    if (!s) {
      s = {
        isOnline: false, onlineSince: null, cashHeld: 0,
        declined: new Set(), paidOutSatang: 0, tipsSatang: 0, pendingPayout: null, workBase: null,
        lastLocation: null, lastPingAt: null,
      };
      riderStates.set(accountId, s);
    }
    return s;
  };

  /** พิกัดร้าน ร้านที่ไม่มีใน seed ตกมาที่ใจกลางย่าน ไม่ใช่ (0,0) กลางมหาสมุทร */
  const shopCoords = (restaurantId: string) =>
    seedRestaurantCoords[restaurantId] ?? { lat: 13.7802, lng: 100.5432 };

  /** สำเนาออเดอร์พร้อมตำแหน่งไรเดอร์ ณ ตอนที่อ่าน (design C6) */
  function withMapPoints(order: Order): Order {
    const running = order.status !== 'delivered' && order.status !== 'cancelled';
    const at = order.riderId && running ? riderState(order.riderId).lastLocation : null;
    return { ...order, riderLocation: at ? { ...at } : null };
  }

  /** แปลงออเดอร์เป็นงานตามที่ไรเดอร์เห็น พิกัดร้าน/ปลายทางมาจาก seed */
  function toRiderJob(order: Order) {
    const shop = restaurants.find((r) => r.id === order.restaurantId);
    const drop = addresses.find((a) => a.accountId === order.customerId);
    return {
      orderId: order.id,
      reference: order.reference,
      status: order.status as 'accepted' | 'preparing' | 'picked_up',
      restaurantName: shop?.name ?? '',
      restaurantAddress: shop?.name ?? '',
      restaurantLat: shopCoords(order.restaurantId).lat,
      restaurantLng: shopCoords(order.restaurantId).lng,
      dropoffAddress: drop?.addressText ?? '',
      dropoffNote: drop?.note ?? null,
      dropoffLat: drop?.lat ?? 13.78,
      dropoffLng: drop?.lng ?? 100.543,
      prepTimeMinutes: shop?.prepTimeMinutes ?? 15,
      acceptedAt: acceptedAtById.get(order.id) ?? null,
      items: order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        note: i.note ?? null,
        choiceNames: i.choiceNames ?? [],
      })),
      riderPaySatang: order.deliveryFee,
      // ต้องอ่านจาก paymentStatus ปัจจุบันเสมอ ลูกค้าเปลี่ยนไปจ่ายพร้อมเพย์กลางทางได้ (§6.5)
      collectCashSatang:
        order.paymentMethod === 'cash' && order.paymentStatus === 'pending'
          ? order.foodTotal + order.deliveryFee + order.serviceFee
          : 0,
      leaveAtDoor: order.leaveAtDoor,
    };
  }

  /** ตัวเลข §8 ทั้งเก้าตัว ตัวเดียวกันที่ AD1 กับ SA1 ใช้ ต่างกันแค่หน้าต่างเวลา */
  function computeMetrics(days: number) {
    const since = Date.now() - days * 86400_000;
    const inWindow = orders.filter((o) => new Date(o.createdAt).getTime() >= since);
    const delivered = inWindow.filter((o) => o.status === 'delivered');
    const refunded = refundCases.filter((c) => c.status === 'approved');

    const ratio = (num: number, den: number) => (den > 0 ? Number((num / den).toFixed(4)) : null);

    /** นาทีที่ใช้ตั้งแต่กดสั่งจนถึงมือ ใบที่ไม่มีเวลาส่งถึงบันทึกไว้จะถูกตัดออก ไม่ใช่นับเป็น 0 */
    const minutes = delivered
      .map((o) => {
        const at = deliveredAtById.get(o.id);
        return at ? (new Date(at).getTime() - new Date(o.createdAt).getTime()) / 60_000 : null;
      })
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b);

    const median = minutes.length > 0
      ? Math.round(minutes[Math.floor((minutes.length - 1) / 2)]!)
      : null;

    /** §8 กำไรส่วนเพิ่มต่อออเดอร์ = รายได้แพลตฟอร์ม − ค่าธรรมเนียมเกตเวย์ − เงินที่คืนไป */
    const revenue = delivered.reduce(
      (sum, o) => sum + commissionOf(o.foodTotal) + o.serviceFee, 0,
    );
    const refundExpense = refunded.reduce((sum, c) => sum + (c.approvedAmountSatang ?? 0), 0);

    /** อัตราสั่งซ้ำใช้หน้าต่าง 30 วันคงที่เสมอ นิยามของตัวชี้วัดคือ "30 วัน" ไม่ใช่ช่วงที่กำลังดู */
    const last30 = orders.filter((o) => new Date(o.createdAt).getTime() >= Date.now() - 30 * 86400_000);
    const byCustomer = new Map<string, number>();
    for (const o of last30) byCustomer.set(o.customerId, (byCustomer.get(o.customerId) ?? 0) + 1);
    const repeat = [...byCustomer.values()].filter((n) => n >= 2).length;

    return {
      windowDays: days,
      orders: inWindow.length,
      delivered: delivered.length,
      ordersPerRiderHour: null,
      restaurantAcceptRate: ratio(
        inWindow.filter((o) => o.status !== 'created').length, inWindow.length,
      ),
      refundRate: ratio(refunded.length, delivered.length),
      autoDispatchRate: null,
      contributionPerOrderSatang: delivered.length > 0
        ? Math.round((revenue - refundExpense) / delivered.length)
        : null,
      medianDeliveryMinutes: median,
      // §8 "ตรงเวลา" = ถึงมือภายใน 30 นาที ตรงกับเป้าค่ากลางของ §8
      onTimeRate: ratio(minutes.filter((m) => m <= 30).length, delivered.length),
      promptPayRate: ratio(
        inWindow.filter((o) => o.paymentMethod === 'promptpay').length, inWindow.length,
      ),
      repeatOrderRate: ratio(repeat, byCustomer.size),
    };
  }

  function createAccount(input: {
    username: string; fullName: string; phone: string;
    accountType: Account['accountType']; email?: string;
  }): Account {
    if (accounts.some((a) => a.username === input.username)) {
      throw new Error('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
    }
    const acc: Account = {
      id: `u-${++seq}`,
      accountType: input.accountType,
      username: input.username,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      ownedRestaurantIds: [],
      ...(input.accountType === 'rider' ? { riderApproval: 'pending' as const } : {}),
    };
    accounts.push(acc);
    current = acc;
    return { ...acc };
  }

  return {
    config: {
      /** อ่านจาก flag ชุดเดียวกับที่จอ SA4 แก้ ไม่ใช่ค่าคงที่ */
      async get() {
        await delay();
        const methods: PaymentMethod[] = ['promptpay'];
        if (flags.cash_payment) methods.push('cash');
        if (flags.card_payment) methods.push('card');
        return { paymentMethods: methods, registrationOpen: flags.registration_open };
      },
    },

    auth: {
      async login(identifier, password) {
        await delay();
        // identifier = username หรือเบอร์โทร (product-spec §4.2) อีเมลใช้ล็อกอินไม่ได้
        const acc = accounts.find((a) => a.username === identifier || a.phone === identifier);
        if (!acc || password !== MOCK_PASSWORD) {
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        current = acc;
        return { ...acc };
      },

      async requestOtp(phone) {
        await delay();
        if (accounts.some((a) => a.phone === phone)) {
          throw new Error('เบอร์นี้สมัครไว้แล้ว เข้าสู่ระบบได้เลย');
        }
        return { devCode: MOCK_OTP };
      },

      async verifyOtp(_phone, code) {
        await delay();
        if (code !== MOCK_OTP) throw new Error('รหัสไม่ถูกต้อง');
        return MOCK_VERIFICATION_TOKEN;
      },

      async register(input: RegisterInput) {
        await delay();
        if (input.verificationToken !== MOCK_VERIFICATION_TOKEN) {
          throw new Error('ต้องยืนยันเบอร์โทรก่อนสมัคร');
        }
        return createAccount(input);
      },

      async googleSignIn(idToken) {
        await delay();
        // mock ไม่มีบัญชี Google ที่ผูกไว้ล่วงหน้า เดินเส้นทางคนใหม่เสมอ
        if (!idToken) throw new Error('ยืนยันบัญชี Google ไม่สำเร็จ');
        return {
          needsRegistration: true as const,
          googleToken: MOCK_GOOGLE_TOKEN,
          prefill: { email: 'google.user@example.com', fullName: 'ผู้ใช้ Google' },
        };
      },

      async googleRegister(input: GoogleRegisterInput) {
        await delay();
        if (input.googleToken !== MOCK_GOOGLE_TOKEN) throw new Error('ตั๋วนี้ใช้สมัครไม่ได้');
        if (input.verificationToken !== MOCK_VERIFICATION_TOKEN) {
          throw new Error('ต้องยืนยันเบอร์โทรก่อนสมัคร');
        }
        return createAccount(input);
      },

      async restore() {
        await delay();
        // mock ไม่เก็บเซสชันข้ามการเปิดแอป เพราะ state อยู่ในหน่วยความจำอย่างเดียว
        return current ? { ...current } : null;
      },

      async logout() {
        await delay();
        current = null;
      },

      async updateProfile(input) {
        await delay();
        const me = requireLogin();
        const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;

        // อีเมลเป็นช่องทางรีเซ็ตรหัสผ่าน สองบัญชีใช้ซ้ำกันไม่ได้ เหมือนที่เซิร์ฟเวอร์เช็ค
        if (email && accounts.some((a) => a.id !== me.id && a.email === email)) {
          throw new Error('อีเมลนี้มีคนใช้แล้ว');
        }

        const row = accounts.find((a) => a.id === me.id)!;
        row.fullName = input.fullName.trim();
        row.email = email ?? undefined;
        current = { ...row };
        return { ...row };
      },

      async changePassword(input) {
        await delay();
        const me = requireLogin();
        // โหมดจำลองไม่ได้เก็บ hash จริง เทียบกับรหัสของชุดข้อมูลจำลองแทน
        if (input.currentPassword !== MOCK_PASSWORD) {
          throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
        }
        return { ...accounts.find((a) => a.id === me.id)! };
      },

      async changePhone(input) {
        await delay();
        const me = requireLogin();
        if (accounts.some((a) => a.id !== me.id && a.phone === input.phone)) {
          throw new Error('เบอร์นี้มีคนใช้แล้ว');
        }
        const row = accounts.find((a) => a.id === me.id)!;
        row.phone = input.phone;
        current = { ...row };
        return { ...row };
      },
    },

    catalog: {
      async listRestaurants() {
        await delay();
        return restaurants.filter(withinRadius).map(withRating).map(withOpenState);
      },
      async getRestaurant(id) {
        await delay();
        const r = restaurants.find((x) => x.id === id);
        return r ? withOpenState(withRating(r)) : null;
      },
      async getMenu(restaurantId) {
        await delay();
        // คืนของที่หมดมาด้วย ให้จอขึ้นป้าย "หมด" ลูกค้าควรรู้ว่าร้านมีเมนูนี้ แค่วันนี้ไม่มี
        return menuItems.filter((m) => m.restaurantId === restaurantId).map((m) => ({ ...m }));
      },
      async createMenuItem(input) {
        await delay();
        const menuItem: MenuItem = { id: `mi-${++seq}`, ...input };
        menuItems.push(menuItem);
        return { ...menuItem };
      },
      async searchRestaurants(query) {
        await delay();
        const q = query.trim().toLowerCase();
        if (q === '') return [];
        const hitByDish = new Set(
          menuItems.filter((m) => m.name.toLowerCase().includes(q)).map((m) => m.restaurantId),
        );
        return restaurants
          .filter((r) => r.name.toLowerCase().includes(q) || hitByDish.has(r.id))
          .filter(withinRadius)
          .map(withRating)
          .map(withOpenState);
      },
    },

    orders: {
      async create(input: CreateOrderInput) {
        await delay();
        const me = requireLogin();

        // guard กันโกงบังคับที่ชั้น repo (เทียบ server-side) เจ้าของ/ร้านปิด/ไม่อนุมัติ สั่งไม่ได้
        const restaurant = restaurants.find((r) => r.id === input.restaurantId);
        if (!restaurant || !canOrderFromRestaurant(me.id, restaurant)) {
          throw new Error('order.error.ownRestaurant');
        }

        if (!addresses.some((a) => a.accountId === me.id)) {
          throw new Error('order.error.noAddress');
        }

        /** ตีราคาจากเมนู ไม่ใช่จากที่จอส่งมา เหมือนที่เซิร์ฟเวอร์ทำ */
        const items = input.items.map((line) => {
          const menu = menuItems.find((m) => m.id === line.menuItemId);
          if (!menu || menu.restaurantId !== input.restaurantId) {
            throw new Error('order.error.itemNotInMenu');
          }
          if (!menu.isAvailable) throw new Error('order.error.itemUnavailable');

          const chosen = (menu.optionGroups ?? []).flatMap((g) => {
            const picked = g.choices.filter((c) => line.choiceIds.includes(c.id));
            if (picked.length < g.minSelect || picked.length > g.maxSelect) {
              throw new Error('order.error.optionRequired');
            }
            return picked;
          });

          return {
            menuItemId: menu.id,
            name: chosen.length ? `${menu.name} (${chosen.map((c) => c.name).join(', ')})` : menu.name,
            choiceNames: chosen.map((c) => c.name),
            choiceIds: chosen.map((c) => c.id),
            unitPrice: menu.price + chosen.reduce((s, c) => s + c.priceDelta, 0),
            quantity: line.quantity,
            // ข้อความถึงร้านผ่านมาตรง ๆ ไม่มีผลกับราคา
            ...(line.note ? { note: line.note } : {}),
          };
        });

        const foodTotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const drop = addresses.find((a) => a.accountId === me.id);
        /** ค่าธรรมเนียมอ่านจากค่าที่ตั้งไว้ (design SA6) และค่าส่งคิดตามระยะ เหมือนเซิร์ฟเวอร์ */
        const deliveryFee = deliveryFeeOf(
          restaurant.distanceKm,
          pricing.deliveryBaseSatang,
          pricing.deliveryPerKmSatang,
        );
        const order: Order = {
          id: `o-${++seq}`,
          reference: `WD-MOCK${seq}`,
          cancelledBy: null,
          cancelReason: null,
          // R11 สุ่มตั้งแต่สร้าง เพราะลูกค้าต้องเห็นได้ตลอดจากจอติดตาม
          deliveryPin: String(Math.floor(Math.random() * 10_000)).padStart(4, '0'),
          customerId: me.id,
          restaurantId: input.restaurantId,
          status: 'created',
          items,
          foodTotal,
          deliveryFee,
          serviceFee: pricing.serviceFeeSatang,
          paymentMethod: input.paymentMethod,
          // เงินสดยังไม่ได้จ่าย ไรเดอร์เก็บตอนส่ง ช่องทางอื่นจ่ายจบก่อนออเดอร์เริ่มเดิน
          paymentStatus: input.paymentMethod === 'cash' ? 'pending' : 'paid',
          // ลูกค้าติ๊กตอนสั่ง ไม่ใช่ไรเดอร์ติ๊กตอนส่ง (สเปคคลื่น 2 §7)
          leaveAtDoor: input.leaveAtDoor ?? false,
          // ทิปให้หลังส่งถึงแล้วเท่านั้น (design C11) ตอนสั่งจึงเป็นศูนย์เสมอ
          tipSatang: 0,
          createdAt: new Date().toISOString(),
          // พิกัดสามจุดของจอติดตาม (C6) ร้านกับปลายทางรู้ตั้งแต่สั่ง ไรเดอร์ยังไม่มี
          restaurantLat: shopCoords(input.restaurantId).lat,
          restaurantLng: shopCoords(input.restaurantId).lng,
          dropoffLat: drop?.lat ?? null,
          dropoffLng: drop?.lng ?? null,
          riderLocation: null,
        };
        orders.push(order);
        return withMapPoints(order);
      },
      async get(id) {
        await delay();
        const o = orders.find((x) => x.id === id);
        return o ? withMapPoints(o) : null;
      },
      async listForCustomer(customerId) {
        await delay();
        return orders.filter((o) => o.customerId === customerId).map(withMapPoints);
      },
      async updateStatus(id, status, proof) {
        await delay();
        const me = requireLogin();
        const o = orders.find((x) => x.id === id);
        if (!o) throw new Error(`ไม่พบออเดอร์ ${id}`);
        assertTransition(o.status, status); // โยน InvalidTransitionError ถ้าข้ามขั้น

        /** R11 ไรเดอร์ปิดงานต้องกรอกรหัสสี่หลักที่ลูกค้าเห็นบนจอติดตามให้ตรง */
        if (status === 'delivered' && o.riderId === me.id) {
          // รูปคือหลักฐานว่าของถึงที่ บังคับทั้งสองแบบ (สเปคคลื่น 2 §7)
          if (!proof?.photoPath?.trim()) throw new Error('ต้องแนบรูปตอนส่งถึง');
          /** ใบที่ลูกค้าขอวางหน้าประตูไม่บังคับรหัส ลูกค้าไม่อยู่ให้บอก การบังคับ */
          if (!o.leaveAtDoor && (proof?.deliveryPin ?? '') !== o.deliveryPin) {
            throw new Error('รหัสยืนยันไม่ถูกต้อง');
          }
        }

        /** M12 ร้านที่ปฏิเสธต้องบอกเหตุผลเสมอ กติกาเดียวกับ orders.service.ts */
        const shopOfOrder = restaurants.find((r) => r.id === o.restaurantId);
        const byRestaurant = shopOfOrder?.ownerUserId === me.id;
        if (status === 'cancelled' && byRestaurant && !proof?.reason) {
          throw new Error('ต้องเลือกเหตุผลที่ปฏิเสธออเดอร์');
        }

        o.status = status;
        if (status === 'cancelled') {
          o.cancelledBy = byRestaurant
            ? 'restaurant'
            : me.accountType === 'admin' || me.accountType === 'super_admin'
              ? 'admin'
              : 'customer';
          o.cancelReason = proof?.reason ?? null;
        }
        if (status === 'delivered' && proof?.photoPath) o.deliveryPhotoPath = proof.photoPath;
        /** ยกเลิกใบที่จ่ายมาแล้ว = ต้องคืนเงิน ไม่มีรายการ ledger เพราะ ledger */
        if (status === 'cancelled' && o.paymentStatus === 'paid') {
          o.paymentStatus = 'refunded';
        }
        if (status === 'accepted') acceptedAtById.set(o.id, new Date().toISOString());
        if (status === 'picked_up') pickedUpAtById.set(o.id, new Date().toISOString());
        if (status === 'delivered') {
          deliveredAtById.set(o.id, new Date().toISOString());
          /** §6.2 ลูกค้าจ่ายเงินสดตอนรับของ เงินก้อนนั้นเป็นของแพลตฟอร์มแต่ไปอยู่ในมือไรเดอร์ */
          if (o.paymentMethod === 'cash' && o.paymentStatus === 'pending') {
            o.paymentStatus = 'paid';
            if (o.riderId) {
              riderState(o.riderId).cashHeld += o.foodTotal + o.deliveryFee + o.serviceFee;
            }
          }
        }
        return { ...o };
      },
      async payWithPromptPay(orderId) {
        await delay();
        const o = orders.find((x) => x.id === orderId);
        if (!o) throw new Error(`ไม่พบออเดอร์ ${orderId}`);
        // ตรวจซ้ำที่ชั้น repo ไม่ใช่เชื่อว่าจอซ่อนปุ่มไว้แล้ว ของจริงต้องเป็นเซิร์ฟเวอร์ที่ตัดสิน
        if (!canPayNowWithPromptPay(o)) throw new Error('payment.error.cannotSwitch');
        o.paymentMethod = 'promptpay';
        o.paymentStatus = 'paid';
        return { ...o };
      },

      /** ทิปให้ไรเดอร์ (design C11) กติกาชุดเดียวกับ `orders/tipping.ts` ฝั่งเซิร์ฟเวอร์ */
      async tip(orderId, amountSatang) {
        await delay();
        const me = requireLogin();
        const o = orders.find((x) => x.id === orderId);
        if (!o) throw new Error('ไม่พบออเดอร์นี้');
        if (o.customerId !== me.id) throw new Error('ให้ทิปได้เฉพาะออเดอร์ของตัวเอง');
        if (o.status !== 'delivered') throw new Error('ให้ทิปได้หลังจากได้รับอาหารแล้ว');
        if (!o.riderId) throw new Error('ออเดอร์นี้ไม่มีไรเดอร์ให้ทิป');
        if (o.tipSatang > 0) throw new Error('ออเดอร์นี้ให้ทิปไปแล้ว');
        if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
          throw new Error('ยอดทิปต้องเป็นจำนวนเต็มสตางค์ที่มากกว่าศูนย์');
        }
        if (amountSatang > MAX_TIP_SATANG) {
          throw new Error(`ทิปได้สูงสุด ${MAX_TIP_SATANG / 100} บาทต่อออเดอร์`);
        }

        o.tipSatang = amountSatang;
        riderState(o.riderId).tipsSatang += amountSatang;
        return { ...o };
      },
    },

    favorites: {
      async list() {
        await delay();
        const me = requireLogin();
        const ids = favoriteIds.get(me.id) ?? new Set<string>();
        /** ไม่กรองด้วยรัศมี ต่างจาก listRestaurants ร้านที่ตั้งใจบันทึกไว้ต้องไม่หายไป */
        return restaurants
          .filter((r) => ids.has(r.id) && r.isApproved)
          .map(withRating)
          .map(withOpenState);
      },
      async ids() {
        await delay();
        const me = requireLogin();
        return [...(favoriteIds.get(me.id) ?? new Set<string>())];
      },
      async set(restaurantId, on) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.isApproved);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        const mine = favoriteIds.get(me.id) ?? new Set<string>();
        if (on) mine.add(restaurantId);
        else mine.delete(restaurantId);
        favoriteIds.set(me.id, mine);
        return { favorite: on };
      },
    },

    merchant: {
      async registerRestaurant(input) {
        await delay();
        const me = requireLogin();
        // §4.1 ร้านเป็นการอัปเกรดบนบัญชี user ไรเดอร์เปิดร้านไม่ได้
        if (me.accountType !== 'user') throw new Error('เปิดร้านได้เฉพาะบัญชีลูกค้าเท่านั้น');

        /** ไม่มีด่านโซนแล้ว ร้านเปิดได้ทุกที่ในประเทศไทย */

        const shop: Restaurant = {
          id: `r-${++seq}`,
          ownerUserId: me.id,
          name: input.name,
          isApproved: false,
          isOpen: false,
          cuisine: input.cuisine,
          distanceKm: null,
          prepTimeMinutes: input.prepTimeMinutes,
          rating: null,
          opensAt: null,
        };
        restaurants.push(shop);
        return {
          ...toMerchantRestaurant(shop),
          // ผูกโซนให้เฉพาะร้านที่พิกัดตกในโซนที่วาดไว้ นอกนั้นเป็น null ได้ ไม่ใช่ข้อผิดพลาด
          zoneName:
            input.lat > 13.77 && input.lat < 13.79 && input.lng > 100.53 && input.lng < 100.56
              ? 'อารีย์'
              : null,
        };
      },

      async submitForApproval(restaurantId) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.ownerUserId === me.id);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        // §7 ร้านที่อนุมัติแล้วแต่ไม่มีเมนู = ลูกค้ากดเข้าไปเจอหน้าว่าง
        const count = menuItems.filter((m) => m.restaurantId === restaurantId).length;
        if (count < 3) throw new Error(`ต้องมีเมนูอย่างน้อย 3 รายการก่อนส่งให้ตรวจ (ตอนนี้มี ${count})`);
        return { submitted: true };
      },

      async myRestaurants() {
        await delay();
        const me = requireLogin();
        return restaurants
          .filter((r) => r.ownerUserId === me.id)
          .map(toMerchantRestaurant);
      },

      async listOrders(opts) {
        await delay();
        const me = requireLogin();
        const mine = restaurants.filter(
          (r) => r.ownerUserId === me.id && (!opts?.restaurantId || r.id === opts.restaurantId),
        );
        const ids = new Set(mine.map((r) => r.id));
        const queue = (opts?.scope ?? 'queue') === 'queue';

        return orders
          .filter((o) => ids.has(o.restaurantId) && QUEUE_STATUSES.includes(o.status) === queue)
          .sort((a, b) =>
            queue ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
          )
          .map((o) => {
            const commission = commissionOf(o.foodTotal);
            const shop = restaurants.find((r) => r.id === o.restaurantId)!;
            const customer = accounts.find((a) => a.id === o.customerId);
            return {
              id: o.id,
              reference: o.reference,
              restaurantId: o.restaurantId,
              restaurantName: shop.name,
              status: o.status,
              customerName: customer?.fullName ?? '',
              items: o.items.map((i) => ({
                name: i.name,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
                // คำสั่งพิเศษต้องไปถึงครัว เหมือนที่เซิร์ฟเวอร์ส่งมา
                ...(i.note ? { note: i.note } : {}),
              })),
              foodTotal: o.foodTotal,
              commission,
              restaurantPayout: o.foodTotal - commission,
              paymentMethod: o.paymentMethod,
              paymentStatus: o.paymentStatus,
              hasRider: !!o.riderId,
              createdAt: o.createdAt,
              acceptedAt: o.status === 'created' ? null : o.createdAt,
            };
          });
      },

      async setOpen(restaurantId, isOpen) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.ownerUserId === me.id);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        if (!shop.isApproved && isOpen) throw new Error('ร้านนี้ยังรออนุมัติ เปิดรับออเดอร์ไม่ได้');
        shop.isOpen = isOpen;
        // กดเปิดร้านคือการล้างการพักด้วย ไม่งั้นกดเปิดแล้วยังปิดอยู่โดยไม่รู้ว่าเพราะอะไร
        if (isOpen) shopPausedUntil.delete(shop.id);
        return toMerchantRestaurant(shop);
      },

      async setHours(restaurantId, hours) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.ownerUserId === me.id);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        for (const [day, value] of Object.entries(hours)) {
          if (value && value.open === value.close) {
            throw new Error(`เวลาเปิดกับเวลาปิดของวัน${day}ตรงกัน ถ้าจะหยุดให้เลือกว่าปิดทั้งวัน`);
          }
        }
        shopHours.set(shop.id, hours);
        return toMerchantRestaurant(shop);
      },

      async pause(restaurantId, minutes) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.ownerUserId === me.id);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        if (minutes > MAX_PAUSE_MINUTES) {
          throw new Error(`พักได้ครั้งละไม่เกิน ${MAX_PAUSE_MINUTES} นาที นานกว่านั้นให้ปิดร้าน`);
        }
        if (minutes === 0) shopPausedUntil.delete(shop.id);
        else shopPausedUntil.set(shop.id, new Date(Date.now() + minutes * 60_000).toISOString());
        return toMerchantRestaurant(shop);
      },

      async updateMenuItem(menuItemId, patch) {
        await delay();
        const me = requireLogin();
        const item = menuItems.find((m) => m.id === menuItemId);
        const shop = item && restaurants.find((r) => r.id === item.restaurantId);
        if (!item || shop?.ownerUserId !== me.id) throw new Error('ไม่พบเมนูนี้');
        Object.assign(item, patch);
        return { ...item };
      },

      async summary(restaurantId) {
        await delay();
        const me = requireLogin();
        const mine = restaurants.filter(
          (r) => r.ownerUserId === me.id && (!restaurantId || r.id === restaurantId),
        );
        const ids = new Set(mine.map((r) => r.id));

        const done = orders.filter((o) => ids.has(o.restaurantId) && o.status === 'delivered');
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const today = done.filter(
          (o) => new Date(deliveredAtById.get(o.id) ?? o.createdAt) >= startOfToday,
        );

        // คอมมิชชัน 15% ของค่าอาหารเท่านั้น ไม่รวมค่าส่ง/ค่าบริการ (product-spec §6.1)
        const salesOf = (rows: Order[]) => {
          const foodSalesSatang = rows.reduce((s, o) => s + o.foodTotal, 0);
          const commissionSatang = rows.reduce((s, o) => s + commissionOf(o.foodTotal), 0);
          return {
            orders: rows.length,
            foodSalesSatang,
            commissionSatang,
            netSatang: foodSalesSatang - commissionSatang,
          };
        };

        return {
          today: salesOf(today),
          last7Days: salesOf(done),
          openQueue: orders.filter(
            (o) => ids.has(o.restaurantId) && ['created', 'accepted', 'preparing'].includes(o.status),
          ).length,
          restaurantCount: mine.length,
        };
      },

      /**
       * ยอดถอนของร้านในโหมดข้อมูลจำลอง คิดจากยอดที่ร้านได้ของใบที่ส่งถึงแล้ว
       * ลบใบที่ขอถอนไปแล้วในเซสชันนี้ พฤติกรรมเดียวกับฝั่งเซิร์ฟเวอร์ที่อ่านจากสมุดบัญชี
       */
      async payoutBalance(restaurantId) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId && r.ownerUserId === me.id);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        return payoutBalanceOf(restaurantId);
      },

      async payoutHistory(restaurantId) {
        await delay();
        return merchantPayouts
          .filter((p) => p.restaurantId === restaurantId)
          .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
      },

      async requestPayout(restaurantId, amountSatang) {
        await delay();
        const b = payoutBalanceOf(restaurantId);
        if (b.pending) throw new Error('มีคำขอถอนที่รอทีมงานยืนยันอยู่แล้ว');
        if (amountSatang <= 0 || amountSatang > b.withdrawableSatang) {
          throw new Error(`ถอนได้ไม่เกิน ${b.withdrawableSatang / 100} บาท`);
        }
        const created: MerchantPayout = {
          id: `mp-${merchantPayouts.length + 1}`,
          restaurantId,
          amountSatang,
          status: 'requested',
          rejectionReason: null,
          requestedAt: new Date().toISOString(),
          decidedAt: null,
        };
        merchantPayouts.push(created);
        return created;
      },
    },

    rider: {
      async status() {
        await delay();
        const me = requireLogin();
        const state = riderState(me.id);

        /** mock ไม่มีเครื่องจ่ายงานจริง จำลองว่า "ออนไลน์อยู่และมีออเดอร์ที่ร้านรับแล้ว */
        const candidate = state.isOnline
          ? orders.find(
              (o) =>
                !o.riderId &&
                (o.status === 'accepted' || o.status === 'preparing') &&
                // §4.3 ไม่เสนอออเดอร์ที่ไรเดอร์คนนี้สั่งเอง
                o.customerId !== me.id &&
                // ผ่านไปแล้วให้ "ข้ามไปใบถัดไป" ไม่ใช่หยุดเสนอทั้งหมด (ตรงกับ tick() ฝั่งเซิร์ฟเวอร์)
                !state.declined.has(o.id),
            )
          : undefined;

        const offer = candidate
          ? {
              ...toRiderJob(candidate),
              offerId: `offer-${candidate.id}`,
              expiresAt: new Date(Date.now() + 15_000).toISOString(),
            }
          : null;

        return {
          approval: me.riderApproval ?? 'approved',
          isOnline: state.isOnline,
          onlineSince: state.onlineSince,
          cashHeldSatang: state.cashHeld,
          cashLimitSatang: 150_000,
          /** ตำแหน่งที่ส่งมาล่าสุดจริง ๆ ไม่ใช่ค่าคงที่ จอ R7 กับ R10 คิดระยะจากค่านี้ */
          lastLocation: state.isOnline
            ? (state.lastLocation ?? { lat: 13.7802, lng: 100.5432 })
            : null,
          activeJobs: orders.filter((o) => o.riderId === me.id && o.status !== 'delivered' && o.status !== 'cancelled')
            .map(toRiderJob),
          offer,
        };
      },

      async setOnline(isOnline, at) {
        await delay();
        const me = requireLogin();
        if ((me.riderApproval ?? 'approved') !== 'approved') throw new Error('บัญชีไรเดอร์ยังรออนุมัติ');
        // ตรงกับเซิร์ฟเวอร์: ไม่รู้พิกัดก็ให้คะแนนระยะทางไม่ได้ จึงออนไลน์ไม่ได้
        if (isOnline && !at) throw new Error('ต้องเปิดตำแหน่งก่อนเริ่มรับงาน');
        const state = riderState(me.id);
        state.isOnline = isOnline;
        state.onlineSince = isOnline ? (state.onlineSince ?? new Date().toISOString()) : null;
        if (at) {
          state.lastLocation = { ...at };
          state.lastPingAt = new Date().toISOString();
        }
        return this.status();
      },

      async ping(lat, lng) {
        await delay();
        // ต้องเก็บจริง ไม่ใช่รับแล้วทิ้ง จอ R7/R10 คิดระยะจากค่านี้ ค่าค้างเก่าคือระยะผิด
        const state = riderState(requireLogin().id);
        state.lastLocation = { lat, lng };
        state.lastPingAt = new Date().toISOString();
      },

      async jobs() {
        await delay();
        const me = requireLogin();
        return orders
          .filter((o) => o.riderId === me.id && o.status !== 'delivered' && o.status !== 'cancelled')
          .map(toRiderJob);
      },

      async acceptOffer(orderId) {
        await delay();
        const me = requireLogin();
        const order = orders.find((o) => o.id === orderId);
        if (!order) throw new Error('ไม่พบงานนี้');
        if (order.riderId) throw new Error('งานนี้มีคนรับไปแล้ว');
        // product-spec §4.3 ไรเดอร์รับงานออเดอร์ที่ตัวเองสั่งไม่ได้
        if (order.customerId === me.id) throw new Error('รับงานออเดอร์ที่ตัวเองสั่งไม่ได้');
        order.riderId = me.id;
        return toRiderJob(order);
      },

      async declineOffer(orderId) {
        await delay();
        const me = requireLogin();
        riderState(me.id).declined.add(orderId);
      },

      async stats() {
        await delay();
        const me = requireLogin();
        const delivered = orders.filter((o) => o.riderId === me.id && o.status === 'delivered').length;
        const state = riderState(me.id);
        const hours = state.onlineSince
          ? (Date.now() - new Date(state.onlineSince).getTime()) / 3_600_000
          : 0;
        // ยังไม่เคยออนไลน์ = ยังไม่มีค่านี้ ไม่ใช่ 0 (0 อ่านเหมือน "ทำได้แย่")
        return {
          hours: Number(hours.toFixed(2)),
          delivered,
          ordersPerHour: hours > 0 ? Number((delivered / hours).toFixed(2)) : null,
        };
      },

      async zones() {
        await delay();
        return MOCK_ZONES.map((z) => ({ ...z }));
      },

      async application() {
        await delay();
        const me = requireLogin();
        return (
          riderApplications.get(me.id)
          ?? { status: 'none' as const, rejectionReason: null, profile: null }
        );
      },

      async submitApplication(input) {
        await delay();
        const me = requireLogin();
        // §4.1 ไรเดอร์เลือกตอนสมัครบัญชี ไม่ใช่ความสามารถที่บัญชี user เพิ่มทีหลัง
        if (me.accountType !== 'rider') throw new Error('เฉพาะบัญชีไรเดอร์เท่านั้นที่ส่งใบสมัครนี้ได้');

        const current = riderApplications.get(me.id)?.status;
        if (current === 'approved') throw new Error('ใบสมัครได้รับการอนุมัติแล้ว แก้ไขข้อมูลเองไม่ได้');
        if (current === 'pending') throw new Error('ส่งใบสมัครไปแล้ว กำลังรอตรวจสอบ');

        // ตรวจซ้ำที่ชั้น repo เหมือนที่เซิร์ฟเวอร์ทำ ไม่ใช่เชื่อว่าจอกันไว้แล้ว
        const errors = validateDraft({ ...input }, new Date());
        if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0]!);

        const app: RiderApplication = {
          status: 'pending',
          rejectionReason: null,
          profile: {
            nationalId: input.nationalId.replace(/\D/g, ''),
            dateOfBirth: input.dateOfBirth,
            vehicleRegistration: input.vehicleRegistration.trim(),
            licenceExpiry: input.licenceExpiry,
            compulsoryInsuranceExpiry: input.compulsoryInsuranceExpiry,
            bankName: input.bankName.trim(),
            bankAccountNumber: input.bankAccountNumber.replace(/\D/g, ''),
            bankAccountName: input.bankAccountName.trim(),
            emergencyContactName: input.emergencyContactName.trim(),
            emergencyContactPhone: input.emergencyContactPhone.replace(/\D/g, ''),
            preferredZoneId: input.preferredZoneId ?? null,
          },
        };
        riderApplications.set(me.id, app);
        return app;
      },

      async earnings(period = 'week' as EarningsPeriod) {
        await delay();
        const me = requireLogin();
        const stats = await this.stats();
        const since = periodStart(period, new Date());

        const mine = orders
          .filter((o) => o.riderId === me.id && o.status === 'delivered')
          .map((o) => {
            const deliveredAt = deliveredAtById.get(o.id) ?? o.createdAt;
            const drop = addresses.find((a) => a.accountId === o.customerId);
            const pickedUpAt = pickedUpAtById.get(o.id);
            return {
              orderId: o.id,
              reference: o.reference,
              restaurantName:
                restaurants.find((r) => r.id === o.restaurantId)?.name ?? o.restaurantId,
              dropoffAddress: drop?.addressText ?? '',
              deliveredAt,
              // รายได้ของไรเดอร์คือค่าส่ง ไม่ใช่ยอดที่ลูกค้าจ่าย
              riderPaySatang: o.deliveryFee,
              paymentMethod: o.paymentMethod,
              distanceKm: drop
                ? Number(haversineKm(shopCoords(o.restaurantId), drop).toFixed(1))
                : 0,
              durationMinutes: pickedUpAt
                ? Math.max(
                  0,
                  Math.round(
                    (new Date(deliveredAt).getTime() - new Date(pickedUpAt).getTime()) / 60_000,
                  ),
                )
                : 0,
            };
          })
          .filter((d) => new Date(d.deliveredAt) >= since)
          .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));

        return {
          ...stats,
          period,
          totalPaySatang: mine.reduce((s, d) => s + d.riderPaySatang, 0),
          distanceKm: Number(mine.reduce((s, d) => s + d.distanceKm, 0).toFixed(1)),
          deliveries: mine,
        };
      },

      /** R9 แจ้งปัญหาแล้ว สถานะออเดอร์ต้องไม่ขยับ ไรเดอร์ไม่ใช่คนตัดสิน */
      async reportIssue(input) {
        await delay();
        const me = requireLogin();
        const order = orders.find((o) => o.id === input.orderId);
        if (!order || order.riderId !== me.id) throw new Error('ไม่พบงานนี้');
        if (!ISSUE_REPORTABLE.includes(order.status)) {
          throw new Error('งานนี้จบไปแล้ว แจ้งปัญหาผ่านช่องนี้ไม่ได้');
        }

        riderIssueList.push({
          id: `ri-${++seq}`,
          orderId: order.id,
          riderId: me.id,
          kind: input.kind,
          detail: input.detail?.trim() ? input.detail.trim() : null,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
        });
      },

      async documents() {
        await delay();
        return documentsOf(requireLogin().id).map((d) => ({ ...d }));
      },

      /** ของจริงเป็นสามขั้น: ขอลิงก์เซ็นชื่อ → อัปโหลดเข้า Supabase → บันทึกเส้นทางกลับมา */
      async uploadDocument(kind, file) {
        await delay();
        const me = requireLogin();
        if (!ALLOWED_DOC_EXT.includes(file.ext.toLowerCase())) {
          throw new Error(`นามสกุลไฟล์ ${file.ext} ไม่รองรับ`);
        }

        // ส่งใหม่ = ยังไม่มีใครตรวจ ต้องล้างทั้งสถานะผ่านและเหตุผลที่เคยถูกปฏิเสธ
        const doc: RiderDocument = {
          kind,
          status: 'reviewing',
          rejectionReason: null,
          uploadedAt: new Date().toISOString(),
        };
        riderDocs.set(`${me.id}:${kind}`, doc);
        riderDocUris.set(`${me.id}:${kind}`, file.uri);
        return { ...doc };
      },

      /** mock ข้ามการอัปโหลดจริงไป แต่ยังตรวจนามสกุลเหมือนเซิร์ฟเวอร์ */
      async uploadDeliveryPhoto(orderId, file) {
        await delay();
        const me = requireLogin();
        if (!ALLOWED_DOC_EXT.includes(file.ext.toLowerCase())) {
          throw new Error(`นามสกุลไฟล์ ${file.ext} ไม่รองรับ`);
        }
        return `${me.id}/proof-${orderId}-${Date.now()}.${file.ext.toLowerCase()}`;
      },

      async workBase() {
        await delay();
        return riderState(requireLogin().id).workBase;
      },

      async setWorkBase(input) {
        await delay();
        const state = riderState(requireLogin().id);
        // ตรวจซ้ำที่ repo เหมือนที่เซิร์ฟเวอร์ทำ ไม่ใช่เชื่อว่าจอกันไว้แล้ว
        if (!Number.isInteger(input.radiusKm) || input.radiusKm < 1 || input.radiusKm > 20) {
          throw new Error('รัศมีต้องอยู่ระหว่าง 1 ถึง 20 กม.');
        }
        state.workBase = { ...input };
        return state.workBase;
      },

      async balance() {
        await delay();
        const me = requireLogin();
        const state = riderState(me.id);

        // รายได้ค้างจ่าย = ค่าส่งของทุกใบที่ส่งถึงแล้ว ลบส่วนที่ถอนไปแล้ว
        const earned = orders
          .filter((o) => o.riderId === me.id && o.status === 'delivered')
          .reduce((sum, o) => sum + o.deliveryFee, 0);
        // ทิปเป็นรายได้ของไรเดอร์เต็มจำนวน จึงบวกเข้ายอดค้างจ่ายเหมือนค่าส่ง (§6.2)
        const payableSatang = earned + state.tipsSatang - state.paidOutSatang;
        const cashHeldSatang = state.cashHeld;

        return {
          payableSatang,
          cashHeldSatang,
          // ติดลบได้ ห้ามปัดเป็นศูนย์ §6.2 ยอดที่ไรเดอร์ค้างต้องไม่หายไปเงียบ ๆ
          withdrawableSatang: payableSatang - cashHeldSatang,
          pending: state.pendingPayout,
        };
      },

      async requestPayout(amountSatang) {
        await delay();
        const me = requireLogin();
        const state = riderState(me.id);

        if (state.pendingPayout) throw new Error('มีคำขอถอนที่รอแอดมินยืนยันอยู่แล้ว');
        if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
          throw new Error('ยอดถอนต้องเป็นจำนวนเต็มสตางค์ที่มากกว่าศูนย์');
        }

        const b = await this.balance();
        if (amountSatang > b.withdrawableSatang) {
          throw new Error(`ถอนได้ไม่เกิน ${b.withdrawableSatang} สตางค์`);
        }

        const payout: RiderPayout = {
          id: `payout-${me.id}-${Date.now()}`,
          amountSatang,
          status: 'requested',
          rejectionReason: null,
          requestedAt: new Date().toISOString(),
          decidedAt: null,
        };
        state.pendingPayout = payout;
        return payout;
      },
    },

    refunds: {
      async open(input) {
        await delay();
        const me = requireLogin();
        const order = orders.find((o) => o.id === input.orderId && o.customerId === me.id);
        if (!order) throw new Error('ไม่พบออเดอร์นี้');
        if (refundCases.some((c) => c.orderId === order.id && (c.status === 'open' || c.status === 'auto_verified'))) {
          throw new Error('ออเดอร์นี้มีเรื่องที่กำลังตรวจอยู่แล้ว');
        }

        /** ตรรกะการตรวจอัตโนมัติจริงอยู่ฝั่งเซิร์ฟเวอร์ (refunds/autoVerify.ts) */
        const total = order.foodTotal + order.deliveryFee + order.serviceFee;
        const fault: RefundFault | null =
          input.reason === 'damaged' || input.reason === 'not_delivered' ? 'rider'
            : input.reason === 'late' ? 'platform'
              : input.reason === 'other' ? null
                : 'restaurant';
        const full = fault !== null && total <= 20_000;

        const c: RefundCase = {
          id: `rc-${++seq}`,
          orderId: order.id,
          reference: order.reference,
          status: 'auto_verified',
          customerReason: `${input.reason}: ${input.detail}`,
          autoVerdict: full ? 'suggest_full' : 'needs_review',
          reasoning: full
            ? ['ตรวจอัตโนมัติผ่านทุกข้อ — เสนอคืนเต็มจำนวน']
            : ['ต้องให้คนตรวจก่อน'],
          suggestedAmountSatang: full ? total : null,
          approvedAmountSatang: null,
          fault,
          createdAt: new Date().toISOString(),
          decidedAt: null,
        };
        refundCases.push(c);
        return { ...c };
      },

      async mine() {
        await delay();
        const me = requireLogin();
        const mineIds = new Set(orders.filter((o) => o.customerId === me.id).map((o) => o.id));
        return refundCases.filter((c) => mineIds.has(c.orderId)).map((c) => ({ ...c }));
      },
    },

    admin: {
      async exceptions() {
        await delay();
        requireLogin();
        const open = refundCases.filter((c) => c.status === 'auto_verified' || c.status === 'open');
        const disputes = open.map((c) => {
          const order = orders.find((o) => o.id === c.orderId)!;
          const shop = restaurants.find((r) => r.id === order.restaurantId);
          const minutes = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60_000);
          return {
            kind: 'open_dispute' as const,
            orderId: order.id,
            reference: order.reference,
            restaurantName: shop?.name ?? '',
            status: order.status,
            minutesWaiting: minutes,
            detail: `ลูกค้าแจ้งปัญหามา ${minutes} นาทีแล้วยังไม่ได้ตัดสิน`,
          };
        });

        /** เรื่องที่ไรเดอร์แจ้ง (R9) ไม่มีเกณฑ์เวลาเหมือนอันอื่น */
        const issues = riderIssueList
          .filter((i) => i.resolvedAt === null)
          .map((i) => {
            const order = orders.find((o) => o.id === i.orderId)!;
            const shop = restaurants.find((r) => r.id === order.restaurantId);
            return {
              kind: 'rider_issue' as const,
              orderId: order.id,
              reference: order.reference,
              restaurantName: shop?.name ?? '',
              status: order.status,
              minutesWaiting: Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 60_000),
              detail: RIDER_ISSUE_DETAIL[i.kind] + (i.detail ? ` · ไรเดอร์เขียนว่า "${i.detail}"` : ''),
              riderIssueId: i.id,
            };
          });

        return [...disputes, ...issues].sort((a, b) => b.minutesWaiting - a.minutesWaiting);
      },

      async decideRiderDocument(accountId, kind, input) {
        await delay();
        requireLogin();
        const key = `${accountId}:${kind}`;
        const doc = riderDocs.get(key);
        if (!doc) throw new Error('ยังไม่ได้ส่งเอกสารชนิดนี้');

        // §7 ปฏิเสธต้องมีเหตุผล ไม่งั้นไรเดอร์ไม่รู้ว่าต้องแก้อะไร
        if (!input.approve && !input.rejectionReason?.trim()) {
          throw new Error('ต้องระบุเหตุผลที่ไม่ผ่าน');
        }

        const next: RiderDocument = input.approve
          ? { ...doc, status: 'verified', rejectionReason: null }
          : { ...doc, status: 'rejected', rejectionReason: input.rejectionReason!.trim() };
        riderDocs.set(key, next);
        return { ...next };
      },

      async resolveRiderIssue(issueId) {
        await delay();
        requireLogin();
        const issue = riderIssueList.find((i) => i.id === issueId && i.resolvedAt === null);
        if (!issue) throw new Error('ไม่พบเรื่องนี้ หรือถูกเคลียร์ไปแล้ว');
        issue.resolvedAt = new Date().toISOString();
      },

      async metrics() {
        await delay();
        requireLogin();
        return computeMetrics(7);
      },

      async openRefunds() {
        await delay();
        requireLogin();
        return refundCases
          .filter((c) => c.status === 'auto_verified' || c.status === 'open')
          .map((c) => ({ ...c }));
      },

      async decideRefund(caseId, input) {
        await delay();
        requireLogin();
        const c = refundCases.find((x) => x.id === caseId);
        if (!c) throw new Error('ไม่พบเรื่องนี้');
        if (c.status === 'approved' || c.status === 'rejected') throw new Error('เรื่องนี้ตัดสินไปแล้ว');

        if (!input.approve) {
          c.status = 'rejected';
        } else {
          const fault = input.fault ?? c.fault;
          // ไม่รู้ว่าใครรับผิดชอบ = ไม่รู้ว่าจะหักจากบัญชีไหน (§6.4)
          if (!fault) throw new Error('ต้องระบุว่าใครรับผิดชอบก่อนอนุมัติคืนเงิน');
          c.status = 'approved';
          c.fault = fault;
          c.approvedAmountSatang = input.amountSatang ?? c.suggestedAmountSatang ?? 0;
          const order = orders.find((o) => o.id === c.orderId);
          if (order) order.paymentStatus = 'refunded';
        }
        c.decidedAt = new Date().toISOString();
        return { ...c };
      },

      async forceDispatch() {
        await delay();
        requireLogin();
        // mock ไม่มีเครื่องจ่ายงาน ของจริงอยู่ที่ dispatch/dispatch.service.ts
        return { offered: false, reason: 'โหมดจำลองไม่มีเครื่องจ่ายงาน' };
      },

      async pendingRestaurants() {
        await delay();
        requireLogin();
        return restaurants
          .filter((r) => !r.isApproved)
          .map((r) => {
            const owner = accounts.find((a) => a.id === r.ownerUserId);
            return {
              ...toMerchantRestaurant(r),
              ownerName: owner?.fullName ?? '',
              ownerPhone: owner?.phone ?? '',
              addressText: r.name,
              menuItemCount: menuItems.filter((m) => m.restaurantId === r.id).length,
              createdAt: new Date().toISOString(),
            };
          });
      },

      async decideRestaurant(restaurantId, approve) {
        await delay();
        requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId);
        if (!shop) throw new Error('ไม่พบร้านนี้');
        shop.isApproved = approve;
        return toMerchantRestaurant(shop);
      },

      async pendingRiders() {
        await delay();
        requireLogin();
        const out = [];
        for (const [accountId, app] of riderApplications) {
          if (app.status !== 'pending' || !app.profile) continue;
          const person = accounts.find((a) => a.id === accountId);
          if (!person) continue;
          out.push({
            ...app.profile,
            accountId,
            fullName: person.fullName,
            phone: person.phone,
            zoneName: MOCK_ZONES.find((z) => z.id === app.profile!.preferredZoneId)?.name ?? null,
            // §7 ชื่อบัญชีไม่ตรงชื่อจริง = ธงบัญชีม้า ให้แอดมินดู ไม่ใช่ตัดสินอัตโนมัติ
            bankNameMatches: bankNameMatchesLegalName(app.profile.bankAccountName, person.fullName),
          });
        }
        return out;
      },

      async ridersHoldingCash() {
        await delay();
        requireLogin();
        const out = [];
        for (const [accountId, st] of riderStates) {
          if (st.cashHeld <= 0) continue;
          const person = accounts.find((a) => a.id === accountId);
          if (!person) continue;
          out.push({
            accountId,
            fullName: person.fullName,
            phone: person.phone,
            cashHeldSatang: st.cashHeld,
            cashLimitSatang: CASH_LIMIT_SATANG,
            atLimit: st.cashHeld >= CASH_LIMIT_SATANG,
          });
        }
        return out.sort((a, b) => b.cashHeldSatang - a.cashHeldSatang);
      },

      /** คำขอถอนที่รอตัดสิน (design R12) เก่าสุดขึ้นก่อน คนที่รอนานที่สุดต้องไม่ตกท้ายแถว */
      async riderPayouts() {
        await delay();
        requireLogin();
        const out = [];
        for (const [accountId, st] of riderStates) {
          if (!st.pendingPayout) continue;
          const person = accounts.find((a) => a.id === accountId);
          if (!person) continue;
          out.push({
            id: st.pendingPayout.id,
            accountId,
            fullName: person.fullName,
            phone: person.phone,
            amountSatang: st.pendingPayout.amountSatang,
            requestedAt: st.pendingPayout.requestedAt,
          });
        }
        return out.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
      },

      async merchantPayouts() {
        await delay();
        requireLogin();
        return merchantPayouts
          .filter((p) => p.status === 'requested')
          .map((p) => ({
            id: p.id,
            restaurantId: p.restaurantId,
            restaurantName: restaurants.find((r) => r.id === p.restaurantId)?.name ?? p.restaurantId,
            amountSatang: p.amountSatang,
            requestedAt: p.requestedAt,
          }));
      },

      async decideMerchantPayout(payoutId, input) {
        await delay();
        requireLogin();
        const row = merchantPayouts.find((p) => p.id === payoutId);
        if (!row) throw new Error('ไม่พบคำขอถอน');
        if (row.status !== 'requested') throw new Error('คำขอนี้ถูกตัดสินไปแล้ว');
        if (!input.approve && !input.rejectionReason?.trim()) {
          throw new Error('ปฏิเสธต้องบอกเหตุผล');
        }
        row.status = input.approve ? 'paid' : 'rejected';
        row.rejectionReason = input.approve ? null : input.rejectionReason!.trim();
        row.decidedAt = new Date().toISOString();
        return row;
      },

      async decideRiderPayout(payoutId, input) {
        await delay();
        requireLogin();

        if (!input.approve && !input.rejectionReason?.trim()) {
          throw new Error('ปฏิเสธต้องบอกเหตุผล');
        }

        const found = [...riderStates.entries()]
          .find(([, st]) => st.pendingPayout?.id === payoutId);
        if (!found) throw new Error('ไม่พบคำขอถอน');
        const [accountId, state] = found;
        const payout = state.pendingPayout!;

        if (!input.approve) {
          state.pendingPayout = null;
          return {
            ...payout,
            status: 'rejected' as const,
            rejectionReason: input.rejectionReason!.trim(),
            decidedAt: new Date().toISOString(),
          };
        }

        /** ตรวจยอดซ้ำตอนยืนยัน ไม่ใช่เชื่อยอดตอนขอ เหมือนที่เซิร์ฟเวอร์ทำ (§6.2) */
        const earned = orders
          .filter((o) => o.riderId === accountId && o.status === 'delivered')
          .reduce((sum, o) => sum + o.deliveryFee, 0);
        const withdrawable = earned - state.paidOutSatang - state.cashHeld;
        if (payout.amountSatang > withdrawable) {
          throw new Error(`ยอดสุทธิเหลือ ${withdrawable} สตางค์ ถอนตามที่ขอไม่ได้แล้ว`);
        }

        state.paidOutSatang += payout.amountSatang;
        state.pendingPayout = null;
        return {
          ...payout,
          status: 'paid' as const,
          decidedAt: new Date().toISOString(),
        };
      },

      /** จอเฝ้าออเดอร์ (design AD2) กรองด้วยกฎชุดเดียวกับเซิร์ฟเวอร์ (`src/lib/adminOrders`) */
      async orders(filter) {
        await delay();
        requireLogin();
        const now = Date.now();

        return orders
          .map((o) => ({
            id: o.id,
            reference: o.reference,
            status: o.status,
            restaurantName: restaurants.find((r) => r.id === o.restaurantId)?.name ?? '',
            dropoffLabel: addresses.find((a) => a.accountId === o.customerId)?.label ?? '',
            riderName: o.riderId
              ? accounts.find((a) => a.id === o.riderId)?.fullName ?? null
              : null,
            grandTotalSatang: o.foodTotal + o.deliveryFee + o.serviceFee,
            createdAt: o.createdAt,
            minutesElapsed: Math.floor((now - new Date(o.createdAt).getTime()) / 60_000),
          }))
          .filter((row) => matchesFilter(filter, row))
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      },

      async liveOps() {
        await delay();
        requireLogin();
        const live = orders.filter((o) => isActiveStatus(o.status));

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const deliveredToday = orders.filter(
          (o) => o.status === 'delivered'
            && deliveredAtById.has(o.id)
            && new Date(deliveredAtById.get(o.id)!).getTime() >= startOfDay.getTime(),
        );

        const durations = deliveredToday
          .map((o) => (new Date(deliveredAtById.get(o.id)!).getTime()
            - new Date(o.createdAt).getTime()) / 60_000)
          .sort((a, b) => a - b);

        return {
          activeOrders: live.length,
          ridersOnline: [...riderStates.values()].filter((s) => s.isOnline).length,
          unassigned: live.filter((o) => !o.riderId).length,
          gmvTodaySatang: deliveredToday.reduce(
            (s, o) => s + o.foodTotal + o.deliveryFee + o.serviceFee, 0,
          ),
          // ยังไม่มีใบไหนส่งสำเร็จวันนี้ = ยังวัดไม่ได้ ต้องเป็น null ไม่ใช่ 0 (§10)
          medianDeliveryMinutes: durations.length === 0
            ? null
            : Math.round(durations[Math.floor(durations.length / 2)]),
        };
      },

      /** ยอดค้างจ่ายรายร้าน (design AD7) */
      async restaurantPayables() {
        await delay();
        requireLogin();

        const payable = new Map<string, { amount: number; orders: number }>();
        for (const o of orders) {
          if (o.status !== 'delivered') continue;
          const cur = payable.get(o.restaurantId) ?? { amount: 0, orders: 0 };
          cur.amount += o.foodTotal - commissionOf(o.foodTotal);
          cur.orders += 1;
          payable.set(o.restaurantId, cur);
        }

        for (const c of refundCases) {
          if (c.status !== 'approved' || c.fault !== 'restaurant') continue;
          const order = orders.find((o) => o.id === c.orderId);
          if (!order) continue;
          const cur = payable.get(order.restaurantId);
          if (cur) cur.amount -= c.approvedAmountSatang ?? 0;
        }

        for (const [restaurantId, paid] of restaurantSettled) {
          const cur = payable.get(restaurantId);
          if (cur) cur.amount -= paid;
        }

        return [...payable.entries()]
          .filter(([, v]) => v.amount > 0)
          .map(([restaurantId, v]) => {
            const shop = restaurants.find((r) => r.id === restaurantId);
            return {
              restaurantId,
              name: shop?.name ?? '',
              ownerName: accounts.find((a) => a.id === shop?.ownerUserId)?.fullName ?? '',
              payableSatang: v.amount,
              orderCount: v.orders,
            };
          })
          .sort((a, b) => b.payableSatang - a.payableSatang);
      },

      async settleRestaurant(restaurantId) {
        await delay();
        requireLogin();
        const row = (await this.restaurantPayables()).find(
          (p) => p.restaurantId === restaurantId,
        );
        // ร้านที่ไม่มียอดค้างต้องกดไม่ได้ ไม่ใช่จ่าย ฿0 เงียบ ๆ
        if (!row) throw new Error('ร้านนี้ไม่มียอดค้างให้จ่าย');

        restaurantSettled.set(
          restaurantId,
          (restaurantSettled.get(restaurantId) ?? 0) + row.payableSatang,
        );
        return { paidSatang: row.payableSatang };
      },

      async opsMap() {
        await delay();
        requireLogin();

        const riders = [];
        for (const [accountId, st] of riderStates) {
          // ออนไลน์แต่ยังไม่เคยส่งพิกัด = ไม่มีที่ให้ปักหมุด ต้องไม่หลุดออกไปเป็น (0,0)
          if (!st.isOnline || !st.lastLocation) continue;
          const person = accounts.find((a) => a.id === accountId);
          if (!person) continue;
          riders.push({
            accountId,
            fullName: person.fullName,
            lat: st.lastLocation.lat,
            lng: st.lastLocation.lng,
            busy: orders.some((o) => o.riderId === accountId && isActiveStatus(o.status)),
            lastPingAt: st.lastPingAt ?? null,
          });
        }

        return {
          riders,
          orders: orders
            .filter((o) => isActiveStatus(o.status))
            .map((o) => {
              const drop = addresses.find((a) => a.accountId === o.customerId);
              return {
                id: o.id,
                reference: o.reference,
                lat: drop?.lat ?? 13.78,
                lng: drop?.lng ?? 100.543,
                status: o.status,
                hasRider: !!o.riderId,
              };
            }),
        };
      },

      /** คิวตั๋ว (design AD4) ใหม่สุดขึ้นก่อน เหมือนที่เซิร์ฟเวอร์เรียง */
      async tickets(status) {
        await delay();
        requireLogin();
        return tickets
          .filter((t) => !status || t.status === status)
          .map(toTicketRow)
          .reverse();
      },

      async closeTicket(ticketId) {
        await delay();
        requireLogin();
        const ticket = tickets.find((t) => t.id === ticketId && t.status === 'open');
        if (!ticket) throw new Error('ไม่พบตั๋วนี้ หรือถูกปิดไปแล้ว');
        ticket.status = 'closed';
      },

      /** เอกสาร KYC พร้อมลิงก์ดูรูป (design AD6) mock คืน uri ที่เก็บไว้ตอนอัปโหลด */
      async riderDocuments(accountId) {
        await delay();
        requireLogin();
        return documentsOf(accountId).map((d) => ({
          ...d,
          url: riderDocUris.get(`${accountId}:${d.kind}`) ?? null,
        }));
      },

      async settleRiderCash(accountId, amountSatang) {
        await delay();
        requireLogin();
        if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
          throw new Error('ยอดนำส่งต้องเป็นจำนวนเต็มสตางค์ที่มากกว่าศูนย์');
        }
        const st = riderState(accountId);
        // รับเกินยอดที่ถืออยู่ไม่ได้ เกินแปลว่านับเงินผิด หรือมีใบที่ไม่ได้ถูกบันทึก
        if (amountSatang > st.cashHeld) {
          throw new Error('ยอดนำส่งเกินเงินสดที่ไรเดอร์ถืออยู่');
        }
        st.cashHeld -= amountSatang;
        return { riderAccountId: accountId, settledSatang: amountSatang, cashHeldSatang: st.cashHeld };
      },

      async decideRider(accountId, input) {
        await delay();
        requireLogin();
        const app = riderApplications.get(accountId);
        if (!app) throw new Error('ไม่พบใบสมัครนี้');
        if (!input.approve && !input.rejectionReason?.trim()) {
          throw new Error('ต้องบอกเหตุผลที่ปฏิเสธ');
        }
        const next: RiderApplication = {
          ...app,
          status: input.approve ? 'approved' : 'rejected',
          rejectionReason: input.approve ? null : input.rejectionReason!.trim(),
        };
        riderApplications.set(accountId, next);
        const person = accounts.find((a) => a.id === accountId);
        if (person) person.riderApproval = next.status as never;
        return next;
      },
    },

    addresses: {
      async list() {
        await delay();
        const me = requireLogin();
        return addresses.filter((a) => a.accountId === me.id).map(({ accountId, ...a }) => a);
      },
      async add(input: NewAddressInput) {
        await delay();
        const me = requireLogin();
        const address = { id: `addr-${++seq}`, accountId: me.id, ...input };
        addresses.push(address);
        const { accountId, ...pub } = address;
        return pub;
      },
    },

    /** ตั๋วซัพพอร์ตฝั่งผู้ใช้ (design AD4) */
    chat: {
      async thread(orderId, channel) {
        await delay();
        const me = requireLogin();
        const { order, ownerId } = chatPartiesOf(orderId);

        // ตอบเหมือนไม่มีห้องนี้ทุกกรณี ไม่ยืนยันว่าออเดอร์ใบนี้มีอยู่จริงให้คนที่ไม่เกี่ยว
        if (!chatCanRead(me.id, channel, order, ownerId)) throw new Error('ไม่พบห้องแชทนี้');

        const peerId = channel === 'customer_rider'
          ? (me.id === order.customerId ? order.riderId ?? null : order.customerId)
          : (me.id === order.customerId ? ownerId : order.customerId);

        return {
          orderId,
          channel,
          peerName: accounts.find((a) => a.id === peerId)?.fullName ?? null,
          closed: order.status === 'delivered' || order.status === 'cancelled',
          messages: chatMessages
            .filter((m) => m.orderId === orderId && m.channel === channel)
            .map((m) => ({
              ...m,
              senderName: accounts.find((a) => a.id === m.senderAccountId)?.fullName ?? '',
              mine: m.senderAccountId === me.id,
            })),
        };
      },

      async send(orderId, channel, body) {
        await delay();
        const me = requireLogin();
        const { order, ownerId } = chatPartiesOf(orderId);
        if (!chatCanRead(me.id, channel, order, ownerId)) throw new Error('ไม่พบห้องแชทนี้');
        if (order.status === 'delivered' || order.status === 'cancelled') {
          throw new Error('ออเดอร์นี้จบแล้ว ส่งข้อความไม่ได้');
        }
        const text = body.trim();
        if (!text) throw new Error('พิมพ์ข้อความก่อนส่ง');

        chatMessages.push({
          id: `msg-${chatMessages.length + 1}`,
          orderId,
          channel,
          senderAccountId: me.id,
          body: text,
          createdAt: new Date().toISOString(),
        });
      },
    },

    reviews: {
      async write(orderId, input) {
        await delay();
        const me = requireLogin();
        const order = orders.find((o) => o.id === orderId);
        if (!order) throw new Error('ไม่พบออเดอร์นี้');

        // กติกาสามข้อเดียวกับ reviews/eligibility.ts ฝั่งเซิร์ฟเวอร์ คะแนนที่ปั้มได้ไม่มีความหมาย
        if (order.customerId !== me.id) throw new Error('รีวิวได้เฉพาะออเดอร์ของตัวเอง');
        if (order.status !== 'delivered') throw new Error('รีวิวได้หลังจากได้รับอาหารแล้ว');
        if (reviewList.some((v) => v.orderId === orderId)) throw new Error('ออเดอร์นี้รีวิวไปแล้ว');

        if (!Number.isInteger(input.restaurantRating)
          || input.restaurantRating < 1 || input.restaurantRating > 5) {
          throw new Error('ให้ดาวร้านอย่างน้อย 1 ดาว');
        }
        if ((input.photoPaths?.length ?? 0) > 4) throw new Error('แนบรูปได้สูงสุด 4 รูป');

        const review: Review & { restaurantId: string } = {
          id: `review-${orderId}`,
          orderId,
          restaurantId: order.restaurantId,
          authorName: me.fullName,
          restaurantRating: input.restaurantRating,
          // ให้คะแนนไรเดอร์ได้ต่อเมื่อใบนั้นมีไรเดอร์จริง ไม่งั้นคะแนนลอยไม่มีเจ้าของ
          riderRating: order.riderId ? input.riderRating ?? null : null,
          comment: input.comment?.trim() || null,
          photoUrls: input.photoPaths ?? [],
          itemName: order.items[0]?.name ?? null,
          createdAt: new Date().toISOString(),
        };
        reviewList.push(review);
        return { ...review };
      },

      async forOrder(orderId) {
        await delay();
        const found = reviewList.find((v) => v.orderId === orderId);
        return found ? { ...found } : null;
      },

      async forRestaurant(restaurantId) {
        await delay();
        return summariseMock(restaurantId);
      },

      async forMyRestaurant(restaurantId) {
        await delay();
        const me = requireLogin();
        const shop = restaurants.find((r) => r.id === restaurantId);
        // ตอบเหมือนไม่มีร้านนี้ ไม่ยืนยันว่ามีอยู่จริงให้คนที่ไม่ใช่เจ้าของ
        if (!shop || shop.ownerUserId !== me.id) throw new Error('ไม่พบร้านนี้');
        return summariseMock(restaurantId);
      },
    },

    support: {
      async open(input) {
        await delay();
        const me = requireLogin();
        if (!input.subject.trim() || !input.body.trim()) {
          throw new Error('ต้องใส่หัวข้อและรายละเอียด');
        }
        if (input.orderId) {
          const order = orders.find((o) => o.id === input.orderId);
          // ผูกออเดอร์ของคนอื่นไม่ได้ ไม่งั้นอ่านรายละเอียดใบนั้นจากคำตอบแอดมินได้
          if (!order || order.customerId !== me.id) throw new Error('ไม่พบออเดอร์นี้');
        }

        const id = `tk-${++seq}`;
        const now = new Date().toISOString();
        tickets.push({
          id,
          orderId: input.orderId ?? null,
          openedByAccountId: me.id,
          kind: input.kind,
          subject: input.subject.trim(),
          status: 'open',
          createdAt: now,
        });
        ticketMessages.push({
          id: `tm-${++seq}`, ticketId: id, authorAccountId: me.id, body: input.body.trim(),
          createdAt: now,
        });
        return { id };
      },

      async mine() {
        await delay();
        const me = requireLogin();
        // ใหม่สุดขึ้นก่อน เหมือนที่เซิร์ฟเวอร์เรียง
        return tickets.filter((t) => t.openedByAccountId === me.id).map(toTicketRow).reverse();
      },

      async thread(ticketId) {
        await delay();
        const me = requireLogin();
        const ticket = readableTicket(me, ticketId);
        const mine = ticketMessages.filter((m) => m.ticketId === ticketId);
        const answered = mine.some((m) => {
          const author = accounts.find((a) => a.id === m.authorAccountId);
          return author?.accountType === 'admin' || author?.accountType === 'super_admin';
        });
        return {
          ticket: {
            id: ticket.id,
            orderId: ticket.orderId,
            kind: ticket.kind,
            subject: ticket.subject,
            status: ticket.status,
            createdAt: ticket.createdAt,
          },
          // กติกาเดียวกับ `support/officeHours.ts` ฝั่งเซิร์ฟเวอร์ คิดตอนอ่าน ไม่เขียนลงเธรด
          autoReply: !answered && ticket.status === 'open' && isOutsideOfficeHours(new Date())
            ? { nextOpenAt: nextOpenAt(new Date()).toISOString() }
            : null,
          messages: ticketMessages
            .filter((m) => m.ticketId === ticketId)
            .map((m) => {
              const author = accounts.find((a) => a.id === m.authorAccountId);
              return {
                id: m.id,
                authorAccountId: m.authorAccountId,
                authorName: author?.fullName ?? '',
                fromStaff: author?.accountType === 'admin' || author?.accountType === 'super_admin',
                body: m.body,
                createdAt: m.createdAt,
              };
            }),
        };
      },

      async reply(ticketId, body) {
        await delay();
        const me = requireLogin();
        const ticket = readableTicket(me, ticketId);
        if (ticket.status === 'closed') throw new Error('ตั๋วนี้ปิดแล้ว — เปิดตั๋วใหม่ถ้ายังมีเรื่องค้าง');
        if (!body.trim()) throw new Error('พิมพ์ข้อความก่อนส่ง');

        ticketMessages.push({
          id: `tm-${++seq}`, ticketId, authorAccountId: me.id, body: body.trim(),
          createdAt: new Date().toISOString(),
        });
      },
    },

    /** ซูเปอร์แอดมิน (design SA1–SA6) */
    super: {
      async metrics(days = 30) {
        await delay();
        requireSuper();
        return computeMetrics(days);
      },

      async zones() {
        await delay();
        requireSuper();
        return zoneList.map((z) => ({
          ...z,
          /** mock ไม่ผูกออเดอร์กับโซน (ของจริงใช้ `orders.zone_id`) ตัวเลขรายโซนจึงเป็น 0 จริง ๆ */
          liveOrders: 0,
          ridersOnline: 0,
          gmvSatang: 0,
        }));
      },

      async createZone(input) {
        await delay();
        requireSuper();
        if (!input.name.trim()) throw new Error('ต้องตั้งชื่อโซน');
        const zone = { id: `z-${++seq}`, ...input, name: input.name.trim() };
        zoneList.push(zone);
        return { ...zone, liveOrders: 0, ridersOnline: 0, gmvSatang: 0 };
      },

      async updateZone(id, input) {
        await delay();
        requireSuper();
        const zone = zoneList.find((z) => z.id === id);
        if (!zone) throw new Error('ไม่พบโซนนี้');
        if (!input.name.trim()) throw new Error('ต้องตั้งชื่อโซน');
        Object.assign(zone, input, { name: input.name.trim() });
        return { ...zone, liveOrders: 0, ridersOnline: 0, gmvSatang: 0 };
      },

      async admins() {
        await delay();
        requireSuper();
        return accounts
          .filter((a) => a.accountType === 'admin' || a.accountType === 'super_admin')
          .map((a) => ({
            accountId: a.id,
            username: a.username,
            fullName: a.fullName,
            phone: a.phone,
            role: a.accountType,
          }));
      },

      async grantAdmin(username, role) {
        await delay();
        const target = accounts.find((a) => a.username === username.trim());
        if (!target) throw new Error(`ไม่พบบัญชีชื่อ ${username}`);
        return this.setRole(target.id, role);
      },

      async setRole(accountId, role) {
        await delay();
        const me = requireSuper();
        // ถอนสิทธิ์ตัวเองแล้วกู้คืนไม่ได้ ต้องไปแก้ที่ฐานข้อมูลตรง ๆ กันไว้ตั้งแต่ต้น
        if (me.id === accountId) {
          throw new Error('เปลี่ยนบทบาทของตัวเองไม่ได้ — ให้ซูเปอร์แอดมินคนอื่นเป็นคนเปลี่ยนให้');
        }
        const target = accounts.find((a) => a.id === accountId);
        if (!target) throw new Error('ไม่พบบัญชีนี้');
        /** บัญชีไรเดอร์เปลี่ยนเป็นผู้ดูแลระบบไม่ได้ ของจริงมี trigger บังคับว่าเจ้าของ */
        if (target.accountType === 'rider') {
          throw new Error('บัญชีไรเดอร์เปลี่ยนเป็นผู้ดูแลระบบไม่ได้');
        }

        const before = target.accountType;
        target.accountType = role;
        writeAudit(me, {
          action: 'role.changed',
          subjectType: 'account',
          subjectId: accountId,
          before: { role: before, username: target.username },
          after: { role },
        });
        return { accountId, role };
      },

      async config() {
        await delay();
        requireSuper();
        return {
          pricing: { ...pricing },
          flags: { ...flags },
          flagKeys: [...MOCK_FLAG_KEYS],
        };
      },

      async setPricing(input) {
        await delay();
        const me = requireSuper();
        for (const [key, value] of Object.entries(input)) {
          // §5 กติกาข้อ 1 เงินเป็นจำนวนเต็มสตางค์เสมอ ไม่มีข้อยกเว้นแม้ในช่องตั้งค่า
          if (!Number.isInteger(value)) throw new Error(`${key} ต้องเป็นจำนวนเต็ม`);
        }
        if (input.commissionRateBp < 100 || input.commissionRateBp > 3000) {
          throw new Error('อัตราค่าคอมมิชชันต้องอยู่ระหว่าง 1% ถึง 30%');
        }

        const before = { ...pricing };
        pricing = { ...input, updatedAt: new Date().toISOString() };
        writeAudit(me, {
          action: 'pricing.changed',
          subjectType: 'platform_pricing',
          subjectId: 'singleton',
          before: {
            commissionRateBp: before.commissionRateBp,
            deliveryBaseSatang: before.deliveryBaseSatang,
            deliveryPerKmSatang: before.deliveryPerKmSatang,
            serviceFeeSatang: before.serviceFeeSatang,
          },
          after: { ...input },
        });
        return { ...pricing };
      },

      async setFlag(key, enabled) {
        await delay();
        const me = requireSuper();
        if (!MOCK_FLAG_KEYS.includes(key)) throw new Error('ไม่รู้จัก flag ตัวนี้');

        const before = flags[key];
        flags[key] = enabled;
        writeAudit(me, {
          action: 'flag.changed',
          subjectType: 'feature_flag',
          subjectId: key,
          before: { enabled: before },
          after: { enabled },
        });
        return { key, enabled };
      },

      async audit(action) {
        await delay();
        requireSuper();
        // ใหม่สุดขึ้นก่อน `writeAudit` ใส่หัวแถวอยู่แล้ว จึงไม่ต้องเรียงซ้ำ
        return auditRows.filter((r) => !action || r.action === action).map((r) => ({ ...r }));
      },
    },
  };
}
