import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card, Chip, Badge } from '../../../ui/Surface';
import { ADMIN_TAB_CLEARANCE } from '../../../app/navigators/AdminTabBar';
import type { AdminStackParamList, AdminTabParamList } from '../../../app/navigators/AdminStack';
import type { TicketStatus } from '../../../data/types';
import { useAdminTickets } from '../../support/hooks';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminSupport'>,
  NativeStackScreenProps<AdminStackParamList>
>;

const FILTERS: (TicketStatus | 'all')[] = ['open', 'closed', 'all'];

/** AD4 คิวตั๋วซัพพอร์ต */
export function AdminSupportScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open');

  const { data: tickets = [], isPending } = useAdminTickets(
    filter === 'all' ? undefined : filter,
  );

  return (
    <SafeAreaView
      testID="screen-admin-support"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
        <Text variant="h1">{t('admin.support.title')}</Text>
        <Text variant="small" color="muted">{t('admin.support.subtitle')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: p.space.screen, paddingVertical: p.space.md, gap: p.space.sm,
        }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f}
            testID={`ticket-filter-${f}`}
            label={t(`admin.support.filter.${f}`)}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen, paddingBottom: ADMIN_TAB_CLEARANCE, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {tickets.length === 0 ? (
          /** รายการว่างต้องบอกว่าว่างเพราะอะไร ไม่ใช่จอเปล่าที่ดูเหมือนโหลดไม่ขึ้น */
          <Text testID="admin-tickets-empty" variant="body" color="muted">
            {isPending ? t('common.loading') : t(`admin.support.empty.${filter}`)}
          </Text>
        ) : null}

        {tickets.map((ticket) => (
          <Pressable
            key={ticket.id}
            testID={`admin-ticket-${ticket.id}`}
            accessibilityRole="button"
            onPress={() => navigation.navigate('AdminTicket', { ticketId: ticket.id })}
          >
            <Card>
              <View style={{ gap: p.space.xs }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    gap: p.space.sm,
                  }}
                >
                  <Text variant="body" bold numberOfLines={1} style={{ flex: 1 }}>
                    {ticket.subject}
                  </Text>
                  <Badge
                    label={t(`support.status.${ticket.status}`)}
                    tone={ticket.status === 'open' ? 'brand' : 'neutral'}
                  />
                </View>
                <Text variant="small" color="muted" numberOfLines={1}>
                  {ticket.openedByName} · {t(`support.kindName.${ticket.kind}`)}
                  {ticket.orderReference ? ` · ${ticket.orderReference}` : ''}
                </Text>
                {/* ยังไม่มีใครตอบ = ข้อความเดียวในเธรด สิ่งที่แอดมินต้องเห็นก่อนใบอื่น */}
                {ticket.messageCount <= 1 ? (
                  <Text testID={`admin-ticket-unanswered-${ticket.id}`} variant="small" color="danger">
                    {t('admin.support.unanswered')}
                  </Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
