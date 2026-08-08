import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Input } from '../../ui/Field';
import { Chip } from '../../ui/Surface';
import { Icon } from '../../ui/Icon';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { relativeTime } from '../../lib/format';
import { useChatThread, useSendMessage } from './hooks';
import type { ChatChannel } from '../../data/types';

/** ข้อความสำเร็จรูป แบบเดียวกับที่ Grab กับ LINE MAN มี */
const QUICK_REPLIES: Record<ChatChannel, { rider: string[]; other: string[] }> = {
  customer_rider: {
    rider: ['chat.quick.onTheWay', 'chat.quick.arrived', 'chat.quick.cantFind'],
    other: ['chat.quick.comingDown', 'chat.quick.leaveWithGuard', 'chat.quick.callMe'],
  },
  customer_merchant: {
    rider: [],
    other: ['chat.quick.lessSpicy', 'chat.quick.noUtensils', 'chat.quick.howLong'],
  },
};

/** ห้องแชทของออร์เดอร์ (design C10 M10) จอเดียวใช้ทั้งสองฝั่งและทั้งสองช่อง */
export function ChatScreen({
  orderId,
  channel,
  isRiderView,
  onBack,
}: {
  orderId: string;
  channel: ChatChannel;
  /** ไรเดอร์ได้ข้อความสำเร็จรูปคนละชุดกับลูกค้า เพราะพูดคนละเรื่องกัน */
  isRiderView?: boolean;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: thread } = useChatThread(orderId, channel);
  const send = useSendMessage(orderId, channel);
  const [draft, setDraft] = useState('');

  const quick = QUICK_REPLIES[channel][isRiderView ? 'rider' : 'other'];

  const submit = (text: string) => {
    const body = text.trim();
    if (!body || send.isPending) return;
    setDraft('');
    send.mutate(body);
  };

  return (
    <SafeAreaView
      testID="screen-chat"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={thread?.peerName ?? t('chat.title')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.md,
          gap: p.space.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        {thread?.messages.length === 0 ? (
          <Text testID="chat-empty" variant="small" color="muted" style={{ textAlign: 'center', marginTop: p.space.lg }}>
            {t('chat.empty')}
          </Text>
        ) : null}

        {thread?.messages.map((m) => {
          const when = relativeTime(m.createdAt);
          return (
            <View
              key={m.id}
              testID={`chat-message-${m.id}`}
              style={{
                alignSelf: m.mine ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                backgroundColor: m.mine ? tokens.tealSolid : tokens.bgRaised,
                borderRadius: p.radius.lg,
                paddingHorizontal: p.space.md,
                paddingVertical: p.space.sm,
                gap: 2,
              }}
            >
              <Text variant="small" color={m.mine ? 'onTeal' : 'primary'}>{m.body}</Text>
              <Text variant="caption" color={m.mine ? 'onTealMuted' : 'faint'}>
                {t(when.key, { count: when.count })}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* งานจบแล้วเป็นอ่านอย่างเดียว ไม่ซ่อนห้อง เพราะประวัติยังต้องเปิดดูได้ว่าตกลงอะไรกันไว้ */}
      {thread?.closed ? (
        <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.md }}>
          <Text testID="chat-closed" variant="small" color="muted" style={{ textAlign: 'center' }}>
            {t('chat.closed')}
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.sm, paddingBottom: p.space.sm }}>
          {quick.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: p.space.sm }}>
              {quick.map((key) => (
                <Chip
                  key={key}
                  testID={`chat-quick-${key.split('.').pop()}`}
                  label={t(key)}
                  onPress={() => submit(t(key))}
                />
              ))}
            </ScrollView>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                testID="input-chat"
                accessibilityLabel={t('chat.placeholder')}
                placeholder={t('chat.placeholder')}
                value={draft}
                onChangeText={setDraft}
              />
            </View>
            <Pressable
              testID="btn-send-chat"
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              onPress={() => submit(draft)}
              disabled={draft.trim() === '' || send.isPending}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: draft.trim() === '' ? tokens.bgSunken : tokens.brandAccent,
              }}
            >
              <Icon name="chevronRight" color={draft.trim() === '' ? tokens.textFaint : '#FFFFFF'} size={22} />
            </Pressable>
          </View>
        </View>
      )}

      {send.isError ? (
        <Text testID="chat-error" variant="small" color="danger" style={{ paddingHorizontal: p.space.screen }}>
          {(send.error as Error).message}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
