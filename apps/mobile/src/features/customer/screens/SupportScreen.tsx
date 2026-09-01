import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip, Badge } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { TicketKind } from '../../../data/types';
import { useMyTickets, useOpenTicket } from '../../support/hooks';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Support'>;

const KINDS: TicketKind[] = ['order_problem', 'payment', 'account', 'other'];

/** ตั๋วซัพพอร์ตฝั่งลูกค้า (design AD4) */
export function SupportScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const orderId = route.params?.orderId;

  const { data: tickets = [], isPending } = useMyTickets();
  const openTicket = useOpenTicket();

  // มาจากจอออเดอร์ = ตั้งใจจะเปิดเรื่องอยู่แล้ว เปิดฟอร์มไว้เลยไม่ต้องกดอีกครั้ง
  const [composing, setComposing] = useState(!!orderId);
  const [kind, setKind] = useState<TicketKind>(orderId ? 'order_problem' : 'other');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !openTicket.isPending;

  return (
    <SafeAreaView
      testID="screen-support"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('support.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingTop: 0, paddingBottom: p.space.xl, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {composing ? (
          <Card testID="support-form">
            <View style={{ gap: p.space.md }}>
              <Text variant="h3">{t('support.newTicket')}</Text>
              {orderId ? (
                <Text testID="support-order-note" variant="small" color="muted">
                  {t('support.aboutOrder')}
                </Text>
              ) : null}

              <Field label={t('support.kind')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
                  {KINDS.map((k) => (
                    <Chip
                      key={k}
                      testID={`ticket-kind-${k}`}
                      label={t(`support.kindName.${k}`)}
                      active={kind === k}
                      onPress={() => setKind(k)}
                    />
                  ))}
                </View>
              </Field>

              <Field label={t('support.subject')}>
                <Input
                  testID="input-subject"
                  value={subject}
                  onChangeText={setSubject}
                  placeholder={t('support.subjectPlaceholder')}
                />
              </Field>

              <Field label={t('support.detail')}>
                <Input
                  testID="input-body"
                  value={body}
                  onChangeText={setBody}
                  placeholder={t('support.detailPlaceholder')}
                  multiline
                  style={{ minHeight: 110, textAlignVertical: 'top' }}
                />
              </Field>

              {openTicket.isError ? (
                <Text testID="support-error" variant="small" color="danger">
                  {t('common.errorGeneric')}
                </Text>
              ) : null}

              <Button
                testID="btn-open-ticket"
                label={t('support.send')}
                disabled={!canSend}
                onPress={() => {
                  if (!canSend) return;
                  openTicket.mutate(
                    { ...(orderId ? { orderId } : {}), kind, subject, body },
                    {
                      onSuccess: ({ id }) => {
                        setComposing(false);
                        setSubject('');
                        setBody('');
                        navigation.navigate('SupportTicket', { ticketId: id });
                      },
                    },
                  );
                }}
              />
              <Button
                testID="btn-cancel-ticket"
                variant="secondary"
                label={t('common.cancel')}
                onPress={() => setComposing(false)}
              />
            </View>
          </Card>
        ) : (
          <Button
            testID="btn-new-ticket"
            label={t('support.newTicket')}
            onPress={() => setComposing(true)}
          />
        )}

        <Text variant="kicker" color="muted">{t('support.myTickets')}</Text>

        {tickets.length === 0 ? (
          <Text testID="support-empty" variant="body" color="muted">
            {isPending ? t('common.loading') : t('support.empty')}
          </Text>
        ) : null}

        {tickets.map((ticket) => (
          <Pressable
            key={ticket.id}
            testID={`ticket-${ticket.id}`}
            accessibilityRole="button"
            onPress={() => navigation.navigate('SupportTicket', { ticketId: ticket.id })}
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
                <Text variant="small" color="muted">
                  {t(`support.kindName.${ticket.kind}`)}
                  {/* ไม่มีเลขที่ใบ = ตั๋วที่ไม่ได้ผูกกับออเดอร์ ต้องไม่โชว์ช่องว่าง */}
                  {ticket.orderReference ? ` · ${ticket.orderReference}` : ''}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
