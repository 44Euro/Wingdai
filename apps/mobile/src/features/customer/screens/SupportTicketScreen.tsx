import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Badge } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import { useTicketThread, useReplyToTicket } from '../../support/hooks';
import { TicketThread } from '../../support/components/TicketThread';

type Props = NativeStackScreenProps<CustomerStackParamList, 'SupportTicket'>;

/** เธรดตั๋วฝั่งลูกค้า (design AD4) ลูกค้าปิดตั๋วเองไม่ได้ ดูเหตุผลใน `SupportRepo` */
export function SupportTicketScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { ticketId } = route.params;

  const { data, isPending } = useTicketThread(ticketId);
  const reply = useReplyToTicket(ticketId);

  return (
    <SafeAreaView
      testID="screen-support-ticket"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader
        title={data?.ticket.subject ?? t('support.title')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingTop: 0, paddingBottom: p.space.xl, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!data ? (
          <Text testID="ticket-loading" variant="body" color="muted">
            {isPending ? t('common.loading') : t('common.errorGeneric')}
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: p.space.sm }}>
              <Badge label={t(`support.kindName.${data.ticket.kind}`)} tone="neutral" />
              <Badge
                label={t(`support.status.${data.ticket.status}`)}
                tone={data.ticket.status === 'open' ? 'brand' : 'neutral'}
              />
            </View>
            <TicketThread
              thread={data}
              isSending={reply.isPending}
              onReply={(body) => reply.mutate(body)}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
