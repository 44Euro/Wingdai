import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Badge } from '../../../ui/Surface';
import { Input } from '../../../ui/Field';
import type { SupportThread } from '../../../data/types';

/** เธรดตั๋ว + ช่องตอบ ใช้ทั้งฝั่งลูกค้าและฝั่งแอดมิน (design AD4) */
export function TicketThread({
  thread,
  onReply,
  isSending,
}: {
  thread: SupportThread;
  onReply: (body: string) => void;
  isSending?: boolean;
}) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const [draft, setDraft] = useState('');

  const closed = thread.ticket.status === 'closed';

  return (
    <View style={{ gap: p.space.md }}>
      {/* ตอบอัตโนมัตินอกเวลาทำการ (design AD4) */}
      {thread.autoReply ? (
        <View
          testID="ticket-auto-reply"
          style={{
            borderRadius: p.radius.md,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: tokens.borderSubtle,
            padding: p.space.md,
            gap: 2,
          }}
        >
          <Text variant="kicker" color="muted">{t('support.autoReply.kicker')}</Text>
          <Text variant="small" color="muted">
            {t('support.autoReply.body', {
              time: new Date(thread.autoReply.nextOpenAt).toLocaleString('th-TH', {
                hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
              }),
            })}
          </Text>
        </View>
      ) : null}

      {thread.messages.map((m) => (
        <Card key={m.id} testID={`ticket-message-${m.id}`}>
          <View style={{ gap: p.space.xs }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                gap: p.space.sm,
              }}
            >
              <Text variant="kicker" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                {m.authorName}
              </Text>
              {m.fromStaff ? (
                <Badge label={t('support.staff')} tone="teal" />
              ) : null}
            </View>
            <Text variant="body">{m.body}</Text>
            <Text variant="caption" color="faint">
              {new Date(m.createdAt).toLocaleString('th-TH')}
            </Text>
          </View>
        </Card>
      ))}

      {closed ? (
        /** บอกว่าทำไมพิมพ์ไม่ได้ ไม่ใช่ซ่อนช่องเฉย ๆ แล้วปล่อยให้เดาว่าแอปพัง */
        <Text testID="ticket-closed-note" variant="small" color="muted">
          {t('support.closedNote')}
        </Text>
      ) : (
        <View style={{ gap: p.space.sm }}>
          <Input
            testID="input-reply"
            value={draft}
            onChangeText={setDraft}
            placeholder={t('support.replyPlaceholder')}
            multiline
            style={{ minHeight: 88, textAlignVertical: 'top' }}
          />
          <Button
            testID="btn-send-reply"
            label={t('support.send')}
            disabled={draft.trim().length === 0 || !!isSending}
            onPress={() => {
              const body = draft.trim();
              if (!body) return;
              onReply(body);
              setDraft('');
            }}
          />
        </View>
      )}
    </View>
  );
}
