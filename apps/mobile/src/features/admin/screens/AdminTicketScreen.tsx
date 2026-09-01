import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import type { AdminStackParamList } from '../../../app/navigators/AdminStack';
import { useTicketThread, useReplyToTicket, useCloseTicket } from '../../support/hooks';
import { TicketThread } from '../../support/components/TicketThread';
import { useOpenRefunds } from '../hooks';
import { SkeletonCards } from '../../../ui/motion';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminTicket'>;

/** AD4 เธรดตั๋วฝั่งแอดมิน */
export function AdminTicketScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { ticketId } = route.params;

  const { data, isPending } = useTicketThread(ticketId);
  const reply = useReplyToTicket(ticketId);
  const close = useCloseTicket();
  const { data: refunds = [] } = useOpenRefunds();

  const orderId = data?.ticket.orderId ?? null;
  const openCase = orderId ? refunds.find((c) => c.orderId === orderId) : undefined;

  return (
    <SafeAreaView
      testID="screen-admin-ticket"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader
        title={data?.ticket.subject ?? t('admin.support.title')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingTop: 0, paddingBottom: p.space.xl, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!data ? (
          isPending ? (
            <SkeletonCards testID="list-loading" count={3} photoHeight={0} />
          ) : (
            <Text testID="admin-ticket-loading" variant="body" color="muted">{t('common.errorGeneric')}</Text>
          )
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: p.space.sm }}>
              <Badge label={t(`support.kindName.${data.ticket.kind}`)} tone="neutral" />
              <Badge
                label={t(`support.status.${data.ticket.status}`)}
                tone={data.ticket.status === 'open' ? 'brand' : 'neutral'}
              />
            </View>

            {openCase ? (
              <Button
                testID="btn-go-refund"
                variant="secondary"
                label={t('admin.support.openRefundCase')}
                onPress={() => navigation.navigate('Tabs', { screen: 'AdminMoney' })}
              />
            ) : orderId ? (
              /** บอกกติกาแทนปุ่ม แอดมินเปิดเคสแทนลูกค้าไม่ได้ตามทางเดินของ §6.4 */
              <Text testID="admin-ticket-refund-note" variant="small" color="muted">
                {t('admin.support.refundStartsWithCustomer')}
              </Text>
            ) : null}

            <TicketThread
              thread={data}
              isSending={reply.isPending}
              onReply={(body) => reply.mutate(body)}
            />

            {data.ticket.status === 'open' ? (
              <Button
                testID="btn-close-ticket"
                variant="secondary"
                label={t('admin.support.close')}
                disabled={close.isPending}
                onPress={() => close.mutate(ticketId)}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
