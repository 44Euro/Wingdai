import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card, Chip, Badge } from '../../../ui/Surface';
import { SUPER_TAB_CLEARANCE } from '../../../app/navigators/SuperAdminTabBar';
import type { AuditRow } from '../../../data/types';
import { useAuditLog } from '../hooks';
import { SkeletonCards } from '../../../ui/motion';

/** จัดกลุ่มการกระทำให้เหลือสี่ชิปที่คนอ่านออก */
const GROUPS = {
  money: ['refund.approved', 'refund.rejected', 'restaurant.settled',
    'rider.cash_settled', 'rider.payout_paid'],
  approval: ['restaurant.approved', 'rider.approved', 'rider.rejected'],
  rules: ['pricing.changed', 'flag.changed'],
  access: ['role.changed'],
} as const;

type GroupKey = keyof typeof GROUPS | 'all';
const GROUP_KEYS: GroupKey[] = ['all', 'money', 'rules', 'access', 'approval'];

/** SA5 ประวัติการกระทำที่แตะเงินหรือสิทธิ์ */
export function SuperAuditScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const [group, setGroup] = useState<GroupKey>('all');

  const { data: rows = [], isPending } = useAuditLog();

  const shown = group === 'all'
    ? rows
    : rows.filter((r) => (GROUPS[group] as readonly string[]).includes(r.action));

  return (
    <SafeAreaView
      testID="screen-super-audit"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
        <Text variant="h1">{t('super.audit.title')}</Text>
        <Text variant="small" color="muted">{t('super.audit.subtitle')}</Text>
      </View>

      {/* flexGrow: 0 กันแถบกินที่ว่างที่เหลือทั้งจอ ไม่งั้นชิปจะยืดสูงตามไปด้วย */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: p.space.screen, paddingVertical: p.space.md, gap: p.space.sm,
        }}
      >
        {GROUP_KEYS.map((key) => (
          <Chip
            key={key}
            testID={`audit-filter-${key}`}
            label={t(`super.audit.group.${key}`)}
            active={group === key}
            onPress={() => setGroup(key)}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen, paddingBottom: SUPER_TAB_CLEARANCE, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {shown.length === 0 ? (
          isPending ? (
            <SkeletonCards testID="list-loading" count={3} photoHeight={0} />
          ) : (
            <Text testID="super-audit-empty" variant="body" color="muted">{t('super.audit.empty')}</Text>
          )
        ) : null}

        {shown.map((row) => <AuditCard key={row.id} row={row} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function AuditCard({ row }: { row: AuditRow }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();

  return (
    <Card testID={`audit-${row.id}`}>
      <View style={{ gap: p.space.sm }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            gap: p.space.md,
          }}
        >
          {/* ชื่อ action ที่ยังไม่มีคำแปลต้องโชว์ค่าดิบ ไม่ใช่หายไป หลักฐานห้ามหล่น */}
          <Text variant="body" bold style={{ flex: 1 }} numberOfLines={1}>
            {t(`super.audit.action.${row.action.replace(/\./g, '_')}`, { defaultValue: row.action })}
          </Text>
          <Badge label={new Date(row.createdAt).toLocaleString('th-TH')} tone="neutral" />
        </View>

        <Text variant="small" color="muted">
          {t('super.audit.by', { name: row.actorName, username: row.actorUsername })}
        </Text>

        <Diff before={row.before} after={row.after} />
      </View>
    </Card>
  );
}

/** ค่าที่เปลี่ยน แสดงเฉพาะคีย์ที่ค่าต่างกันจริง */
function Diff({ before, after }: { before: unknown; after: unknown }) {
  const { primitives: p } = useTheme();
  const b = isRecord(before) ? before : {};
  const a = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .filter((k) => show(b[k]) !== show(a[k]));

  if (keys.length === 0) return null;

  return (
    <View style={{ gap: 2 }}>
      {keys.map((k) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.md }}>
          <Text variant="small" color="muted">{k}</Text>
          <Text variant="small" bold>{show(b[k])} → {show(a[k])}</Text>
        </View>
      ))}
    </View>
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** ค่าที่ไม่มีอยู่ต้องอ่านออกว่า "ไม่มี" ไม่ใช่ช่องว่างที่ดูเหมือนแสดงผลพัง */
const show = (v: unknown): string => (v === undefined || v === null ? '—' : String(v));
