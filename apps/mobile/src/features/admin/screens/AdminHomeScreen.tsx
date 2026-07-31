import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Badge, Card } from '../../../ui/Surface';
import { formatBaht } from '../../../lib/format';
import { useAuthStore } from '../../auth/authStore';
import {
  useExceptions, useAdminMetrics, useOpenRefunds, useDecideRefund, useForceDispatch,
  usePendingRestaurants, useDecideRestaurant,
} from '../hooks';
import type {
  AdminMetrics, OrderException, RefundCase, PendingRestaurant,
} from '../../../data/types';

/**
 * จอแอดมิน — claude.md §7 กำหนดให้เป็นแบบ **exception-based ตั้งแต่ต้น**
 * ไม่ใช่ฟีดออร์เดอร์สดแล้วค่อยเพิ่มตัวกรองทีหลัง เพราะแบบนั้นคือการรื้อ ไม่ใช่การเพิ่มสวิตช์
 *
 * §3 ข้อ 6 — ต้องใช้งานได้เต็มที่บนจอมือถือ จอนี้จึงเป็นคอลัมน์เดียวทั้งหมด
 * ไม่มีตารางที่ต้องเลื่อนแนวนอน และปุ่มตัดสินใจอยู่ในระยะนิ้วโป้ง
 */
export function AdminHomeScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: exceptions = [] } = useExceptions();
  const { data: metrics } = useAdminMetrics();
  const { data: refunds = [] } = useOpenRefunds();
  const { data: pendingShops = [] } = usePendingRestaurants();
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView
      testID="stack-admin"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: p.space.xxl, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
          <Text variant="h1">{t('admin.title')}</Text>
          <Text variant="small" color="muted">{t('admin.subtitle')}</Text>
        </View>

        {metrics ? (
          <View style={{ paddingHorizontal: p.space.screen }}>
            <MetricsCard metrics={metrics} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.exceptions', { count: exceptions.length })}
          </Text>
          {exceptions.length === 0 ? (
            /* ไม่มีอะไรต้องทำคือข่าวดี ต้องเขียนให้อ่านแล้วรู้ว่าดี ไม่ใช่หน้าว่างที่ดูเหมือนโหลดไม่ขึ้น */
            <Text testID="admin-all-clear" variant="body" color="success">
              {t('admin.allClear')}
            </Text>
          ) : (
            exceptions.map((e) => <ExceptionCard key={`${e.kind}-${e.orderId}`} exception={e} />)
          )}
        </View>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.refunds', { count: refunds.length })}
          </Text>
          {refunds.length === 0 ? (
            <Text testID="admin-no-refunds" variant="body" color="muted">
              {t('admin.noRefunds')}
            </Text>
          ) : (
            refunds.map((c) => <RefundCard key={c.id} refundCase={c} />)
          )}
        </View>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {t('admin.pendingShops', { count: pendingShops.length })}
          </Text>
          {pendingShops.length === 0 ? (
            <Text testID="admin-no-shops" variant="body" color="muted">
              {t('admin.noPendingShops')}
            </Text>
          ) : (
            pendingShops.map((s) => <ShopCard key={s.id} shop={s} />)
          )}
        </View>

        <View style={{ paddingHorizontal: p.space.screen }}>
          <Button
            testID="btn-logout"
            variant="secondary"
            label={t('merchant.menu.logout')}
            onPress={() => logout()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** ตัวเลข §8 — ค่าที่ยังวัดไม่ได้ซ่อนไปทั้งแถว ไม่แสดงเป็น 0 หรือขีด */
function MetricsCard({ metrics }: { metrics: AdminMetrics }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();

  const pct = (v: number | null) => (v === null ? null : `${(v * 100).toFixed(1)}%`);

  const rows: { label: string; value: string | null; bad: boolean }[] = [
    {
      label: t('admin.metric.ordersPerRiderHour'),
      value: metrics.ordersPerRiderHour?.toFixed(2) ?? null,
      bad: metrics.ordersPerRiderHour !== null && metrics.ordersPerRiderHour < 3,
    },
    {
      label: t('admin.metric.acceptRate'),
      value: pct(metrics.restaurantAcceptRate),
      bad: metrics.restaurantAcceptRate !== null && metrics.restaurantAcceptRate < 0.95,
    },
    {
      label: t('admin.metric.refundRate'),
      value: pct(metrics.refundRate),
      // §8 เกิน 2% = มีอะไรพังเชิงระบบ ไม่ใช่ความผันผวนปกติ
      bad: metrics.refundRate !== null && metrics.refundRate > 0.02,
    },
    {
      label: t('admin.metric.autoDispatchRate'),
      value: pct(metrics.autoDispatchRate),
      bad: metrics.autoDispatchRate !== null && metrics.autoDispatchRate < 0.9,
    },
  ];

  return (
    <Card testID="admin-metrics">
      <View style={{ gap: p.space.sm }}>
        <Text variant="kicker" color="muted">
          {t('admin.metric.title', { days: metrics.windowDays })}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body" color="muted">{t('admin.metric.orders')}</Text>
          <Text variant="body" bold>{metrics.orders}</Text>
        </View>
        {rows
          .filter((r) => r.value !== null)
          .map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color="muted">{r.label}</Text>
              <Text variant="body" bold color={r.bad ? 'danger' : 'primary'}>{r.value}</Text>
            </View>
          ))}
      </View>
    </Card>
  );
}

function ExceptionCard({ exception }: { exception: OrderException }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const force = useForceDispatch();

  return (
    <Card testID={`exception-${exception.orderId}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="h3">{exception.reference}</Text>
            <Text variant="small" color="muted">{exception.restaurantName}</Text>
          </View>
          <Badge label={t(`admin.kind.${exception.kind}`)} tone="brand" />
        </View>

        {/* บอกว่าต้องทำอะไร ไม่ใช่แค่ว่ามีอะไรผิด */}
        <Text variant="small" color="danger">{exception.detail}</Text>

        {exception.kind === 'no_rider' ? (
          <Button
            testID={`btn-force-dispatch-${exception.orderId}`}
            variant="secondary"
            label={t('admin.forceDispatch')}
            disabled={force.isPending}
            onPress={() => force.mutate(exception.orderId)}
          />
        ) : null}

        {force.data && !force.data.offered ? (
          <Text testID="force-dispatch-result" variant="small" color="muted">
            {force.data.reason}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * §6.4 — ต้องโชว์ "ข้อเสนอพร้อมเหตุผล" ไม่ใช่ปุ่มคืนเงินเปล่า ๆ
 * แอดมินยืนยันด้วยการกดครั้งเดียว แต่ต้องได้อ่านก่อนว่าระบบคิดยังไง
 */
function RefundCard({ refundCase }: { refundCase: RefundCase }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const decide = useDecideRefund();

  const canOneTap = refundCase.suggestedAmountSatang !== null && refundCase.fault !== null;

  return (
    <Card testID={`refund-${refundCase.id}`}>
      <View style={{ gap: p.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="h3">{refundCase.reference ?? refundCase.orderId.slice(0, 8)}</Text>
            <Text variant="small" color="muted">{refundCase.customerReason}</Text>
          </View>
          {refundCase.fault ? (
            <Badge label={t(`admin.fault.${refundCase.fault}`)} tone="teal" />
          ) : null}
        </View>

        <View style={{ gap: 2 }}>
          {refundCase.reasoning.map((line, i) => (
            <Text key={i} variant="small" color="muted">• {line}</Text>
          ))}
        </View>

        {canOneTap ? (
          <Text testID={`refund-suggested-${refundCase.id}`} variant="body" bold>
            {t('admin.suggestedRefund', {
              amount: formatBaht(refundCase.suggestedAmountSatang!),
            })}
          </Text>
        ) : (
          /* ระบบไม่เสนอยอด = แอดมินต้องตัดสินเอง ไม่ใช่มีเลขให้กดตามโดยไม่คิด */
          <Text testID={`refund-needs-review-${refundCase.id}`} variant="small" color="danger">
            {t('admin.needsReview')}
          </Text>
        )}

        <View style={{ gap: p.space.sm }}>
          <Button
            testID={`btn-approve-${refundCase.id}`}
            label={t('admin.approve')}
            disabled={decide.isPending || !canOneTap}
            onPress={() => decide.mutate({ caseId: refundCase.id, approve: true })}
          />
          <Button
            testID={`btn-reject-${refundCase.id}`}
            variant="secondary"
            label={t('admin.reject')}
            disabled={decide.isPending}
            onPress={() => decide.mutate({ caseId: refundCase.id, approve: false })}
          />
        </View>

        {decide.isError ? (
          <Text testID="refund-decide-error" variant="small" color="danger">
            {(decide.error as Error).message}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * ร้านที่รอตรวจ (claude.md §4.3 · §7)
 *
 * §7 บอกให้เก็บรูปหน้าร้านกับเอกสารธุรกิจด้วย — ยังไม่มีเพราะยังไม่ได้ต่อ Storage
 * จอนี้จึงยังตรวจได้ไม่ครบตามสเปค **ต้องเพิ่มก่อนอนุมัติร้านจริง**
 */
function ShopCard({ shop }: { shop: PendingRestaurant }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const decide = useDecideRestaurant();

  // §7 ร้านที่ไม่มีเมนูตั้งต้นอนุมัติไปก็เป็นหน้าว่างสำหรับลูกค้า
  const hasMenu = shop.menuItemCount >= 3;

  return (
    <Card testID={`pending-shop-${shop.id}`}>
      <View style={{ gap: p.space.sm }}>
        <View>
          <Text variant="h3">{shop.name}</Text>
          <Text variant="small" color="muted">{shop.addressText}</Text>
          <Text variant="small" color="muted">
            {shop.ownerName} · {shop.ownerPhone}
          </Text>
        </View>

        <Text variant="small" color={hasMenu ? 'muted' : 'danger'}>
          {t('admin.shopMenuCount', { count: shop.menuItemCount })}
        </Text>

        <View style={{ gap: p.space.sm }}>
          <Button
            testID={`btn-approve-shop-${shop.id}`}
            label={t('admin.approveShop')}
            disabled={decide.isPending || !hasMenu}
            onPress={() => decide.mutate({ restaurantId: shop.id, approve: true })}
          />
        </View>

        {decide.isError ? (
          <Text testID="shop-decide-error" variant="small" color="danger">
            {(decide.error as Error).message}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
